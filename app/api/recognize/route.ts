import { NextResponse } from "next/server";
import {
  CATEGORIES,
  FOOD_CATEGORIES,
  type ItemKind,
  NONFOOD_CATEGORIES,
  canonicalItemName,
  categoriesFor,
  type ExpiryStatus,
  evaluateShareable,
  findSampleByFileName,
  getSample,
  resolveExpiryDate,
  pickSampleByHash,
  sampleExpiryDate,
  sampleExpiryStatus,
  sampleManufacturedOn,
  startOfToday,
  toISODate,
} from "@/lib/rules";

/**
 * gpt-5.4-mini를 쓰는 건 의도적이다. 데모 사진(아침에주스 210mL, 라벨 2026.09.04)으로
 * 후보를 5회씩 돌려보고 골랐다.
 *   gpt-5.4-mini(effort medium) 5/5 정확, 2.1~3.4초  ← 선택
 *   gpt-4.1-mini(temperature 0) 3/3 정확, 3.5~5.1초
 *   gpt-5.4-nano(effort low)    1/2 정확 — 연도를 틀린다. 못 쓴다.
 * effort를 low로 낮추면 gpt-5.4-mini도 2026을 2028로 읽은 적이 있어 medium으로 고정한다.
 */
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const ENDPOINT = "https://api.openai.com/v1/responses";
/** 유통기한 오독은 이 앱에서 가장 비싼 실수다. 속도보다 정확도를 산다. */
const REASONING_EFFORT = "medium";

/** data URL은 base64라 원본의 4/3배가 된다. 요청 크기 제한을 넉넉히 피한다. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** 사진 두 장을 한 요청에 같이 보내므로 합계도 막아둔다. */
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
/** 평소 3초 안에 오지만 가끔 튄다. 그때는 목업으로 넘겨 시연을 안 세운다. */
const TIMEOUT_MS = 25_000;

/**
 * 라벨에 찍힌 날짜가 무엇인지. 이걸 구분하지 않으면 제조일자를 유통기한으로 쓰거나,
 * 반대로 제조일자만 있는 물품을 "기한 없는 품목"으로 통과시키게 된다.
 */
const DATE_KINDS = ["유통기한", "소비기한", "제조일자", "없음", "불명"] as const;

/**
 * 모델이 자유 서술 대신 이 모양으로만 답하게 강제한다.
 * strict 모드는 required에 모든 키가 있고 additionalProperties가 false여야 통과한다.
 */
const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    itemName: { type: "string" },
    genericName: { type: "string" },
    category: { type: "string", enum: CATEGORIES },
    expiryDate: { type: "string" },
    expiryRaw: { type: "string" },
    expiryKind: { type: "string", enum: DATE_KINDS },
    confidence: { type: "number" },
  },
  required: [
    "itemName",
    "genericName",
    "category",
    "expiryDate",
    "expiryRaw",
    "expiryKind",
    "confidence",
  ],
  additionalProperties: false,
};

function buildPrompt(today: string, hasExpiryPhoto: boolean, kind: ItemKind | null) {
  return [
    "너는 푸드뱅크 기부 물품을 검수하는 담당자다. 사진 속 물품을 판독해라.",
    `오늘은 ${today}이다.`,
    // 기부자가 먼저 고른 대분류를 알려준다. 세부분류를 그 안에서만 고르게 하고,
    // 비음식이면 날짜를 찾느라 애쓰지 않게 한다.
    ...(kind === "food"
      ? [
          "",
          "기부자는 이 물품을 '음식'으로 분류했다.",
          `category는 반드시 다음 중 하나. ${FOOD_CATEGORIES.join(", ")}`,
        ]
      : kind === "nonfood"
        ? [
            "",
            "기부자는 이 물품을 '음식이 아님'으로 분류했다.",
            `category는 반드시 다음 중 하나. ${NONFOOD_CATEGORIES.join(", ")}`,
            "먹는 물품이 아니므로 유통기한을 찾지 마라. expiryKind는 '없음'으로 두면 된다.",
          ]
        : []),
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
    // 일반명은 매칭에서 "같은 물건인지" 판단하는 데 쓴다. 판독할 때 같이 받아두면
    // 매칭 화면에서 모델을 또 부를 필요가 없다.
    "genericName: 용량·수량·상표·수식어를 뺀, 그 물건의 가장 일반적인 한국어 이름.",
    "  - 예) '백미 5kg' → '쌀', '햇반 210g' → '즉석밥', '3겹 화장지 30롤' → '화장지'",
    "  - 상표명은 일반명으로 바꿔라. 햇반 → 즉석밥.",
    "  - 서로 다른 물건은 서로 다른 일반명이어야 한다. 찹쌀은 '쌀'이 아니라 '찹쌀'이다.",
    "  - 판단이 안 되면 itemName에서 용량 표기만 뗀 값을 그대로 써라. 지어내지 마라.",
    ...(kind ? [] : [`category: 반드시 다음 중 하나. ${CATEGORIES.join(", ")}`]),
    "expiryRaw: 포장에 적힌 날짜 문구를 본 그대로 옮겨라. 형식을 바꾸지 마라.",
    '  - 예) "2027.05.01", "27.05.01", "2027년 5월", "20270501", "2027.05.01 B4 15:12"',
    '  - 연도가 안 찍힌 라벨도 있다. 그때는 보이는 대로 "09.04", "09월 04일"만 옮겨라.',
    "    연도를 지어내지 마라. 서버가 오늘 날짜를 기준으로 정한다.",
    "  - 연도 네 자리를 끝까지 확인해라. 잉크젯 각인은 6과 8, 0과 9가 닮아 보인다.",
    '  - 날짜 표기가 안 보이면 빈 문자열 "". 지어내지 마라.',
    "expiryKind: expiryRaw에 옮긴 날짜가 포장에 무엇으로 적혀 있었는지 그대로 골라라.",
    "  - '유통기한' — 그 말이 적혀 있거나, 날짜만 찍혀 있고 어떤 날짜인지 안 적혀 있을 때",
    "  - '소비기한' — '소비기한'으로 적혀 있을 때. 이것도 먹을 수 있는 기한이니 그대로 쓴다",
    "  - '제조일자' — '제조일자'·'제조일'만 적혀 있고 먹을 수 있는 기한 표기가 따로 없을 때",
    "  - '없음' — 세제·화장지·기저귀처럼 원래 기한 표기가 없는 품목일 때",
    "  - '불명' — 기한이 있어야 할 식품인데 날짜가 안 보이거나 못 읽을 때",
    "  유통기한과 제조일자가 같이 찍혀 있으면 유통기한 쪽을 옮기고 '유통기한'을 골라라.",
    "  제조일자를 유통기한인 척 쓰지 마라. 제조일자만 있으면 '제조일자'를 고르면 된다.",
    "expiryDate: 위 날짜를 YYYY-MM-DD로 바꿔 적어라.",
    "  - 연·월만 보이면 그 달의 마지막 날로 본다.",
    '  - 날짜 표기가 없으면 빈 문자열 "".',
    '  - 변환이 애매하거나 자신 없으면 빈 문자열 ""로 두고 expiryRaw만 정확히 채워라.',
    "    서버가 표기를 정규화한다. 틀린 날짜를 만드는 것보다 그게 낫다.",
    "confidence: 판독 확신도 0.0~1.0.",
    "",
    "사진에 물품이 없거나 판독이 불가능하면 itemName을 빈 문자열로 두고 confidence를 0으로 해라.",
  ].join("\n");
}

type Recognized = {
  itemName: string;
  /** 용량·상표를 뺀 물건 이름. 매칭에서 같은 물건인지 볼 때 쓴다. */
  genericName: string;
  category: string;
  expiryDate: string | null;
  expiryStatus: ExpiryStatus;
  /** 먹을 수 있는 기한 대신 제조일자만 찍혀 있었을 때 그 날짜. 화면에서 근거로 보여준다. */
  manufacturedOn: string | null;
  confidence: number;
};

/**
 * 판독 실패는 두 가지고, 사용자에게 할 말이 서로 다르다.
 * unrecognized = 모델은 답했는데 물품이 안 보임 → "다시 찍어주세요"
 * failed       = 호출 자체가 안 됨(타임아웃·5xx·키 없음) → 목업으로 대체
 */
type RecognizeOutcome =
  | { status: "ok"; data: Recognized }
  | { status: "unrecognized" }
  | { status: "failed" };

/** 모델 응답은 스키마를 줘도 끝까지 믿지 않는다. 화면에 들어가기 전에 전부 정규화한다. */
function normalize(raw: unknown, kind: ItemKind | null): RecognizeOutcome {
  if (!raw || typeof raw !== "object") return { status: "failed" };
  const data = raw as Record<string, unknown>;

  const itemName = typeof data.itemName === "string" ? data.itemName.trim() : "";
  if (!itemName) return { status: "unrecognized" };

  // 모델이 일반명을 비우거나 빼먹으면 문자열 규칙으로 채운다. 매칭이 멈추지는 않는다.
  const modelGeneric = typeof data.genericName === "string" ? data.genericName.trim() : "";
  const genericName = modelGeneric || canonicalItemName(itemName);

  // 세부분류는 기부자가 고른 대분류 안에서만 인정한다. 모델이 벗어나면 그 대분류의
  // "기타"로 떨어뜨린다. 화면의 선택지와 서버가 인정하는 값이 어긋나면 안 된다.
  const allowedCategories = kind ? categoriesFor(kind) : CATEGORIES;
  const category =
    typeof data.category === "string" && allowedCategories.includes(data.category)
      ? data.category
      : "기타";

  // 모델이 준 ISO를 먼저 보고, 못 쓰면 라벨 원문에서 서버가 직접 뽑는다.
  // 모델은 "27.05.01"처럼 라벨 표기를 그대로 옮겨오기도 하고, 변환에 자신이 없으면
  // expiryDate를 비우고 expiryRaw만 채우라고 시켜뒀다. 둘 다 같은 정규화를 통과시킨다.
  const expiry = typeof data.expiryDate === "string" ? data.expiryDate.trim() : "";
  const expiryRaw = typeof data.expiryRaw === "string" ? data.expiryRaw.trim() : "";
  const parsed = resolveExpiryDate(expiry, expiryRaw);
  const dateKind = typeof data.expiryKind === "string" ? data.expiryKind : "불명";

  /*
    날짜 종류에 따라 상태가 갈린다.

    제조일자만 있는 물품은 유통기한을 계산할 수 없다. 유통기한은 품목마다 달라서
    제조일에 며칠을 더하면 된다는 규칙이 없다. 그래서 날짜를 읽었더라도 유통기한으로
    쓰지 않고 "확인하지 못함"으로 두고, 읽은 제조일자는 사용자가 판단할 근거로 넘긴다.

    소비기한은 유통기한과 같이 취급한다. 먹을 수 있는 기한을 가리키는 표기다.
  */
  let expiryDate: string | null = null;
  let expiryStatus: ExpiryStatus;
  let manufacturedOn: string | null = null;

  if (kind === "nonfood") {
    // 먹는 물품이 아니면 유통기한을 묻지 않는다. 모델이 무슨 날짜를 읽어왔든 무시한다.
    expiryStatus = "none";
  } else if (dateKind === "제조일자") {
    expiryStatus = "unknown";
    manufacturedOn = parsed;
  } else if (dateKind === "없음") {
    expiryStatus = "none";
  } else if (parsed) {
    expiryDate = parsed;
    expiryStatus = "read";
  } else {
    // 유통기한·소비기한이라고 했는데 날짜를 못 만들었거나, 모델이 '불명'을 골랐다.
    expiryStatus = "unknown";
  }

  const rawConfidence = Number(data.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.max(0, Math.min(1, rawConfidence))
    : 0.5;

  return {
    status: "ok",
    data: { itemName, genericName, category, expiryDate, expiryStatus, manufacturedOn, confidence },
  };
}

async function recognizeWithOpenAI(
  productImage: File,
  expiryImage: File | null,
  apiKey: string,
  kind: ItemKind | null
): Promise<RecognizeOutcome> {
  async function toPart(file: File) {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const mime = file.type || "image/jpeg";
    return { type: "input_image", image_url: `data:${mime};base64,${base64}` };
  }

  // 사진마다 앞에 라벨 텍스트를 붙인다. 이게 없으면 모델이 어느 쪽이 유통기한 사진인지 모른다.
  const content: Record<string, unknown>[] = [
    {
      type: "input_text",
      text: buildPrompt(toISODate(startOfToday()), expiryImage !== null, kind),
    },
    { type: "input_text", text: "[사진 1] 제품 사진" },
    await toPart(productImage),
  ];
  if (expiryImage) {
    content.push({ type: "input_text", text: "[사진 2] 유통기한 사진" }, await toPart(expiryImage));
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      input: [{ role: "user", content }],
      reasoning: { effort: REASONING_EFFORT },
      text: {
        format: {
          type: "json_schema",
          name: "recognized",
          strict: true,
          schema: RESPONSE_SCHEMA,
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("[recognize] OpenAI 응답 실패", res.status, (await res.text()).slice(0, 500));
    return { status: "failed" };
  }

  const payload = await res.json();

  // 추론 모델은 output에 reasoning 항목을 먼저 끼워 넣는다. message만 골라야 한다.
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const blocks = output
    .filter((item: { type?: unknown }) => item?.type === "message")
    .flatMap((item: { content?: unknown }) => (Array.isArray(item.content) ? item.content : []));

  // 안전 필터에 걸리면 output_text 대신 refusal이 온다. 목업으로 덮지 않고 실패로 남긴다.
  const refusal = blocks.find((b: { type?: unknown }) => b?.type === "refusal");
  if (refusal) {
    console.error("[recognize] OpenAI 응답 거부", JSON.stringify(refusal).slice(0, 500));
    return { status: "failed" };
  }

  const text = blocks
    .filter(
      (b: { type?: unknown; text?: unknown }) =>
        b?.type === "output_text" && typeof b.text === "string"
    )
    .map((b: { text: string }) => b.text)
    .join("");

  if (!text.trim()) {
    // status가 incomplete면 토큰 한도나 안전 필터에 걸린 것이다. 이유를 로그에 남긴다.
    console.error(
      "[recognize] OpenAI 응답에 텍스트가 없음",
      payload?.status,
      JSON.stringify(payload?.incomplete_details ?? payload).slice(0, 500)
    );
    return { status: "failed" };
  }

  try {
    return normalize(JSON.parse(text), kind);
  } catch {
    console.error("[recognize] OpenAI JSON 파싱 실패", text.slice(0, 500));
    return { status: "failed" };
  }
}

/** API 키가 없거나 호출이 실패해도 시연이 멈추지 않도록 남겨둔 목업 경로. */
function recognizeWithMock(
  image: File,
  requestedSample: string | null,
  kind: ItemKind | null
): Recognized {
  const sample =
    (requestedSample ? getSample(requestedSample) : undefined) ??
    findSampleByFileName(image.name) ??
    pickSampleByHash(image.name, image.size);

  // 비음식으로 골랐으면 기한을 묻지 않고, 세부분류도 그 대분류 안으로 맞춘다.
  const nonfood = kind === "nonfood";
  const allowed = kind ? categoriesFor(kind) : CATEGORIES;

  return {
    itemName: sample.itemName,
    genericName: canonicalItemName(sample.itemName),
    category: allowed.includes(sample.category) ? sample.category : "기타",
    expiryDate: nonfood ? null : sampleExpiryDate(sample),
    expiryStatus: nonfood ? "none" : sampleExpiryStatus(sample),
    manufacturedOn: nonfood ? null : sampleManufacturedOn(sample),
    confidence: sample.confidence,
  };
}

/**
 * 물품 사진 판독.
 * 우선순위: 데모 모드 지정 > OpenAI Vision > 파일명 키워드 > 파일 해시.
 * 데모 모드를 모델보다 위에 두는 건 의도적이다. 발표 중 원하는 분기를 확실히 재현해야 한다.
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

  // 기부자가 사진을 올리기 전에 고른 대분류. 없으면 모델 답에만 의존한다.
  const kindField = formData.get("kind");
  const kind: ItemKind | null =
    kindField === "food" || kindField === "nonfood" ? kindField : null;
  const apiKey = process.env.OPENAI_API_KEY;

  let result: Recognized | null = null;
  let source: "demo" | "openai" | "mock" = "mock";

  if (requestedSample) {
    result = recognizeWithMock(image, requestedSample, kind);
    source = "demo";
  } else if (apiKey) {
    let outcome: RecognizeOutcome;
    try {
      outcome = await recognizeWithOpenAI(image, expiryImage, apiKey, kind);
    } catch (error) {
      console.error("[recognize] OpenAI 호출 예외", error);
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
      source = "openai";
    }
  }

  if (!result) {
    // 목업 경로는 즉시 끝나서 오히려 AI처럼 안 보인다. 시연용으로 최소 지연을 준다.
    await new Promise((resolve) => setTimeout(resolve, 900));
    result = recognizeWithMock(image, null, kind);
    source = "mock";
  }

  const verdict = evaluateShareable(result.expiryDate, result.expiryStatus);

  return NextResponse.json({
    itemName: result.itemName,
    genericName: result.genericName,
    category: result.category,
    expiryDate: result.expiryDate,
    expiryStatus: result.expiryStatus,
    manufacturedOn: result.manufacturedOn,
    confidence: result.confidence,
    source,
    photoCount: expiryImage ? 2 : 1,
    ...verdict,
  });
}
