import { NextResponse } from "next/server";
import {
  CATEGORIES,
  evaluateShareable,
  findSampleByFileName,
  getSample,
  pickSampleByHash,
  sampleExpiryDate,
  startOfToday,
  toISODate,
} from "@/lib/rules";

/**
 * flash-lite를 쓰는 건 의도적이다. 상위 모델(3.6-flash)도 판독 정확도는 같은데
 * 응답이 25초를 넘고 503이 섞여서 시연에 못 쓴다. lite는 같은 사진을 1.5~2초에 읽는다.
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** inline_data는 base64라 원본의 4/3배가 된다. 요청 20MB 제한을 넉넉히 피한다. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 사진 두 장을 한 요청에 같이 보내므로 합계도 막아둔다. */
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
/** 평소 2초 안에 오지만 가끔 25초까지 튄다. 그때는 목업으로 넘겨 시연을 안 세운다. */
const TIMEOUT_MS = 25_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** 모델이 자유 서술 대신 이 모양으로만 답하게 강제한다. */
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    itemName: { type: "STRING" },
    category: { type: "STRING", enum: CATEGORIES },
    expiryDate: { type: "STRING" },
    confidence: { type: "NUMBER" },
  },
  required: ["itemName", "category", "expiryDate", "confidence"],
  propertyOrdering: ["itemName", "category", "expiryDate", "confidence"],
};

function buildPrompt(today: string, hasExpiryPhoto: boolean) {
  return [
    "너는 푸드뱅크 기부 물품을 검수하는 담당자다. 사진 속 물품을 판독해라.",
    `오늘은 ${today}이다.`,
    "",
    hasExpiryPhoto
      ? [
          "사진이 두 장 온다. 둘은 같은 제품을 찍은 것이다.",
          "[사진 1] 제품 사진 — 품목명과 용량/규격을 여기서 읽어라.",
          "[사진 2] 유통기한 사진 — 날짜는 이쪽을 우선해서 읽어라.",
          "[사진 2]에서 날짜를 못 찾으면 [사진 1]에서 찾아봐라.",
        ].join("\n")
      : "사진은 한 장이다. 품목명과 날짜를 모두 이 사진에서 읽어라.",
    "",
    "itemName: 한국어로 '품목명 + 용량/규격'. 예) '참치 통조림 200g', '백미 5kg', '성인용 기저귀 대형'.",
    `category: 반드시 다음 중 하나. ${CATEGORIES.join(", ")}`,
    "expiryDate: 포장에 적힌 유통기한 또는 소비기한을 YYYY-MM-DD로.",
    "  - '제조일자'는 유통기한이 아니다. 유통기한 표기만 읽어라.",
    "  - 2027.05.01 / 27.05.01 / 2027년 5월 1일 / 05 2027 같은 표기를 모두 정규화해라.",
    "  - 연·월만 보이면 그 달의 마지막 날로 본다.",
    '  - 세제·화장지·기저귀처럼 유통기한이 없는 품목이거나, 날짜가 안 보이면 빈 문자열 "".',
    "  - 추측해서 지어내지 마라. 안 보이면 빈 문자열이다.",
    "confidence: 판독 확신도 0.0~1.0.",
    "",
    "사진에 물품이 없거나 판독이 불가능하면 itemName을 빈 문자열로 두고 confidence를 0으로 해라.",
  ].join("\n");
}

type Recognized = {
  itemName: string;
  category: string;
  expiryDate: string | null;
  confidence: number;
};

/**
 * 판독 실패는 두 가지고, 사용자에게 할 말이 서로 다르다.
 * unrecognized = 모델은 답했는데 물품이 안 보임 → "다시 찍어주세요"
 * failed       = 호출 자체가 안 됨(타임아웃·503·키 없음) → 목업으로 대체
 */
type GeminiOutcome =
  | { status: "ok"; data: Recognized }
  | { status: "unrecognized" }
  | { status: "failed" };

/** 모델 응답은 스키마를 줘도 끝까지 믿지 않는다. 화면에 들어가기 전에 전부 정규화한다. */
function normalize(raw: unknown): GeminiOutcome {
  if (!raw || typeof raw !== "object") return { status: "failed" };
  const data = raw as Record<string, unknown>;

  const itemName = typeof data.itemName === "string" ? data.itemName.trim() : "";
  if (!itemName) return { status: "unrecognized" };

  const category =
    typeof data.category === "string" && CATEGORIES.includes(data.category)
      ? data.category
      : "기타";

  const expiry = typeof data.expiryDate === "string" ? data.expiryDate.trim() : "";
  const expiryDate = ISO_DATE.test(expiry) ? expiry : null;

  const rawConfidence = Number(data.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(1, rawConfidence))
    : 0.5;

  return { status: "ok", data: { itemName, category, expiryDate, confidence } };
}

async function recognizeWithGemini(
  productImage: File,
  expiryImage: File | null,
  apiKey: string
): Promise<GeminiOutcome> {
  async function toPart(file: File) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { inline_data: { mime_type: file.type || "image/jpeg", data: base64 } };
  }

  // 사진마다 앞에 라벨 텍스트를 붙인다. 이게 없으면 모델이 어느 쪽이 유통기한 사진인지 모른다.
  const requestParts: Record<string, unknown>[] = [
    { text: buildPrompt(toISODate(startOfToday()), expiryImage !== null) },
    { text: "[사진 1] 제품 사진" },
    await toPart(productImage),
  ];
  if (expiryImage) {
    requestParts.push({ text: "[사진 2] 유통기한 사진" }, await toPart(expiryImage));
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ parts: requestParts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  });

  if (!res.ok) {
    console.error("[recognize] Gemini 응답 실패", res.status, (await res.text()).slice(0, 500));
    return { status: "failed" };
  }

  const payload = await res.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  // thinking 모델은 응답 앞에 사고 파트를 끼워 넣는다. text를 가진 파트만 골라야 한다.
  const text = Array.isArray(parts)
    ? parts
        .filter(
          (part: { text?: unknown; thought?: unknown }) =>
            typeof part?.text === "string" && part.thought !== true
        )
        .map((part: { text: string }) => part.text)
        .join("")
    : "";

  if (!text.trim()) {
    console.error("[recognize] Gemini 응답에 텍스트가 없음", JSON.stringify(payload).slice(0, 500));
    return { status: "failed" };
  }

  try {
    return normalize(JSON.parse(text));
  } catch {
    console.error("[recognize] Gemini JSON 파싱 실패", text.slice(0, 500));
    return { status: "failed" };
  }
}

/** API 키가 없거나 호출이 실패해도 시연이 멈추지 않도록 남겨둔 목업 경로. */
function recognizeWithMock(image: File, requestedSample: string | null): Recognized {
  const sample =
    (requestedSample ? getSample(requestedSample) : undefined) ??
    findSampleByFileName(image.name) ??
    pickSampleByHash(image.name, image.size);

  return {
    itemName: sample.itemName,
    category: sample.category,
    expiryDate: sampleExpiryDate(sample),
    confidence: sample.confidence,
  };
}

/**
 * 물품 사진 판독.
 * 우선순위: 데모 모드 지정 > Gemini Vision > 파일명 키워드 > 파일 해시.
 * 데모 모드를 Gemini보다 위에 두는 건 의도적이다. 발표 중 원하는 분기를 확실히 재현해야 한다.
 * 나눔 가능 여부는 모델 답이 아니라 항상 서버의 evaluateShareable가 판정한다.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");
  const expiryField = formData.get("expiryImage");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "제품 사진이 없습니다" }, { status: 400 });
  }
  // 유통기한 사진은 선택이다. 라벨이 같은 면에 있으면 한 장으로도 충분하다.
  const expiryImage =
    expiryField instanceof File && expiryField.size > 0 ? expiryField : null;

  for (const [file, label] of [
    [image, "제품 사진"],
    ...(expiryImage ? [[expiryImage, "유통기한 사진"] as const] : []),
  ] as [File, string][]) {
    if (file.size === 0) {
      return NextResponse.json(
        { error: `${label}가 빈 파일이에요. 다시 선택해주세요` },
        { status: 400 }
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `${label}가 너무 커요. 10MB 이하로 올려주세요` },
        { status: 413 }
      );
    }
  }
  if (image.size + (expiryImage?.size ?? 0) > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "두 사진 합계가 너무 커요. 더 작은 사진으로 올려주세요" },
      { status: 413 }
    );
  }

  const requested = formData.get("sample");
  const requestedSample = typeof requested === "string" && requested ? requested : null;
  const apiKey = process.env.GEMINI_API_KEY;

  let result: Recognized | null = null;
  let source: "demo" | "gemini" | "mock" = "mock";

  if (requestedSample) {
    result = recognizeWithMock(image, requestedSample);
    source = "demo";
  } else if (apiKey) {
    let outcome: GeminiOutcome;
    try {
      outcome = await recognizeWithGemini(image, expiryImage, apiKey);
    } catch (error) {
      console.error("[recognize] Gemini 호출 예외", error);
      outcome = { status: "failed" };
    }

    // 물품을 못 찾은 건 목업으로 덮으면 안 된다. 엉뚱한 품목을 확신에 차서 보여주게 된다.
    if (outcome.status === "unrecognized") {
      return NextResponse.json(
        { error: "사진에서 물품을 찾지 못했어요. 물품이 잘 보이게 다시 찍어주세요" },
        { status: 422 }
      );
    }
    if (outcome.status === "ok") {
      result = outcome.data;
      source = "gemini";
    }
  }

  if (!result) {
    // 목업 경로는 즉시 끝나서 오히려 AI처럼 안 보인다. 시연용으로 최소 지연을 준다.
    await new Promise((resolve) => setTimeout(resolve, 900));
    result = recognizeWithMock(image, null);
    source = "mock";
  }

  const verdict = evaluateShareable(result.expiryDate);

  return NextResponse.json({
    itemName: result.itemName,
    category: result.category,
    expiryDate: result.expiryDate,
    confidence: result.confidence,
    source,
    photoCount: expiryImage ? 2 : 1,
    ...verdict,
  });
}
