import { AUTO_KEYS, FIELD_KINDS, type ReportForm, normalizeForm } from "./report-form";

/**
 * 기업이 올린 보고 양식(사진·PDF)을 읽어 항목을 뽑는다. 사진 판독(/api/recognize)과 같은
 * 모델·엔드포인트를 쓴다. 양식은 한 번 읽어 저장해 두고 시설이 쓸 때는 다시 부르지 않으므로,
 * 무료 한도(시간당 2회)로도 버틸 수 있다.
 */
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 90_000; // 여러 쪽 PDF는 오래 걸린다

const AUTO_ENUM = ["none", ...Object.keys(AUTO_KEYS)];

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    formCode: { type: "string" },
    intro: { type: "string" },
    closing: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          code: { type: "string" },
          section: { type: "string" },
          label: { type: "string" },
          kind: { type: "string", enum: [...FIELD_KINDS] },
          options: { type: "array", items: { type: "string" } },
          by: { type: "string", enum: ["company", "recipient"] },
          fixed: { type: "string" },
          auto: { type: "string", enum: AUTO_ENUM },
          required: { type: "boolean" },
          hint: { type: "string" },
        },
        required: ["key", "code", "section", "label", "kind", "options", "by", "fixed", "auto", "required", "hint"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "formCode", "intro", "closing", "fields"],
  additionalProperties: false,
};

function prompt() {
  const autos = Object.entries(AUTO_KEYS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  return `이 문서는 기업이 기부물품을 받은 복지시설(수령 기관)에게 작성을 요청하는 양식(수령확인서·결과보고서·활용보고서 등)이다.
여러 쪽이면 빈 양식 쪽들을 기준으로 하라. "붙임·사진 자료"처럼 사진을 붙이는 쪽도 양식이다 — 사진 칸마다 photo 칸 하나로 뽑고,
사진 칸 안의 촬영 일자·설명은 따로 뽑지 마라(사진 칸에 딸린 것으로 본다). 작성 방법·작성 안내 쪽은 각 칸의 작성자·필수 여부를
판단하는 데만 쓰고, 작성 예시(값이 채워진 쪽)는 무시하라.
칸을 문서에 나온 순서대로 뽑아라.

- title: 문서 제목(회사명이 따로 있으면 앞에 붙여 "(주)○○ 기부물품 수령 확인서"처럼).
- formCode: 양식번호가 있으면(예: TOV-CSR-F01), 없으면 빈 문자열.
- intro: 제목 아래 안내 문구 한두 문장, 없으면 빈 문자열.
- closing: 서명란 위 확인 문구(예: "위 물품을 … 수령하였음을 확인합니다."), 없으면 빈 문자열.
- fields: 칸 하나당 하나. 문서번호·결재란·페이지 번호·안내 상자는 넣지 마라.
  - key: 영문 짧은 이름(칸 코드가 있으면 코드 그대로, 예: A1).
  - code: 칸 앞의 코드([A1] → "A1"), 없으면 빈 문자열.
  - section: 칸이 속한 구역 제목(예: "기부자", "수령 기관"), 없으면 빈 문자열.
  - label: 칸 이름 그대로.
  - kind: text 한 줄 / long 여러 줄 서술 / number 숫자 / date 날짜 / datetime 일시 / period 기간 /
          choice 선택지 중 하나(☐가 나열된 칸) / checks 여러 개 체크 / agree 동의 체크 하나 /
          photo 사진 첨부 / sign 서명·직인·인.
  - options: choice·checks면 선택지 문구들, 아니면 빈 배열. "기타 ____"는 "기타".
  - by: 기업(기부자)이 채우는 칸이면 "company", 수령 기관이 채우면 "recipient". 작성 방법·안내 문구(예: "단가·금액은 ○○에서 기재")에
        작성자가 있으면 그대로 따른다. 기부자 구역의 칸은 기업 칸이다.
  - fixed: 기업 칸에 이미 값이 인쇄돼 있으면 그 값, 아니면 빈 문자열.
  - auto: 이 칸에 그대로 들어갈 값이 아래에 있으면 그 이름, 없으면 "none". 기부자(기업) 구역의 칸에는 companyName 말고는 쓰지 마라.
          hubName은 "경유 기관·배분기관"처럼 물품을 거쳐 온 기관을 묻는 칸에만 쓴다(담당 부서·담당자에는 쓰지 않는다).
${autos}
  - required: "필수" 표시가 있거나 작성 방법·안내에 필수로 나오면 true. "선택"이면 false. "식품인 경우 필수"처럼 조건부면 true로 하고 hint에 조건을 적어라.
  - hint: 칸 옆·작성 방법의 짧은 작성 요령, 없으면 빈 문자열. agree면 동의 문구 전체.
- 품목 표(품명·규격·수량… 열)는 한 줄만 있다고 보고 열마다 칸 하나로 뽑아라.
- 문서가 이런 양식이 아니면 title을 빈 문자열로 하고 fields는 빈 배열로 답하라.`;
}

export type FormReadOutcome =
  | { ok: true; form: ReportForm }
  | { ok: false; reason: "no_key" | "rate_limit" | "not_form" | "error"; retryAfterSeconds?: number | null };

/** dataUrl: data:image/...;base64,... 또는 data:application/pdf;base64,... */
export async function readFormDocument(dataUrl: string, fileName: string): Promise<FormReadOutcome> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, reason: "no_key" };

  const isPdf = dataUrl.startsWith("data:application/pdf");
  const filePart = isPdf
    ? { type: "input_file", filename: fileName || "form.pdf", file_data: dataUrl }
    : { type: "input_image", image_url: dataUrl };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        input: [{ role: "user", content: [{ type: "input_text", text: prompt() }, filePart] }],
        reasoning: { effort: "low" },
        text: { format: { type: "json_schema", name: "report_form", strict: true, schema: SCHEMA } },
      }),
    });
  } catch (e) {
    console.error("[form-ai] 요청 실패", e);
    return { ok: false, reason: "error" };
  }

  if (!res.ok) {
    console.error("[form-ai] OpenAI 응답 실패", res.status, (await res.text()).slice(0, 500));
    if (res.status === 429) {
      const header = Number(res.headers.get("retry-after"));
      return { ok: false, reason: "rate_limit", retryAfterSeconds: Number.isFinite(header) && header > 0 ? Math.ceil(header) : null };
    }
    return { ok: false, reason: "error" };
  }

  const payload = await res.json();
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const text = output
    .filter((item: { type?: unknown }) => item?.type === "message")
    .flatMap((item: { content?: unknown }) => (Array.isArray(item.content) ? item.content : []))
    .filter((b: { type?: unknown; text?: unknown }) => b?.type === "output_text" && typeof b.text === "string")
    .map((b: { text: string }) => b.text)
    .join("");
  try {
    const parsed = JSON.parse(text);
    // 모델은 auto 없음을 "none"으로 답한다. normalizeForm은 모르는 값을 null로 바꾼다.
    const form = normalizeForm(parsed);
    return form ? { ok: true, form } : { ok: false, reason: "not_form" };
  } catch {
    console.error("[form-ai] JSON 파싱 실패", text.slice(0, 500));
    return { ok: false, reason: "error" };
  }
}
