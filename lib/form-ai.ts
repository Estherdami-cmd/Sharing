import { AUTO_KEYS, FIELD_KINDS, type ReportForm, normalizeForm } from "./report-form";

/**
 * 기업이 올린 보고 양식(사진·PDF)을 읽어 항목을 뽑는다. 사진 판독(/api/recognize)과 같은
 * 모델·엔드포인트를 쓴다. 양식은 한 번 읽어 저장해 두고 시설이 쓸 때는 다시 부르지 않으므로,
 * 무료 한도(시간당 2회)로도 버틸 수 있다.
 */
const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 45_000;

const AUTO_ENUM = ["none", ...Object.keys(AUTO_KEYS)];

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    fields: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string" },
          label: { type: "string" },
          kind: { type: "string", enum: [...FIELD_KINDS] },
          auto: { type: "string", enum: AUTO_ENUM },
          required: { type: "boolean" },
          hint: { type: "string" },
        },
        required: ["key", "label", "kind", "auto", "required", "hint"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "intro", "fields"],
  additionalProperties: false,
};

function prompt() {
  const autos = Object.entries(AUTO_KEYS)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
  return `이 문서는 기업이 기부물품을 받은 복지시설에게 작성을 요청하는 보고 양식(결과보고서·수령확인서·활용보고서 등)이다.
시설이 채워야 하는 항목을 문서에 나온 순서대로 뽑아라.

규칙:
- title: 문서 제목 그대로(예: "기부물품 활용 결과보고서"). 회사명이 있으면 포함.
- intro: 작성 안내 문구가 있으면 한두 문장으로, 없으면 빈 문자열.
- fields: 칸(빈칸·표의 셀·체크란) 하나당 하나. 장식 문구, 결재란, 페이지 번호는 넣지 마라.
  - key: 영문 camelCase 짧은 이름(예: usage, beneficiaryCount).
  - label: 문서에 적힌 칸 이름 그대로(한국어).
  - kind: text(한 줄), long(여러 줄 서술), number(숫자), date(날짜), photo(사진 첨부).
  - auto: 아래 값 중 이 칸에 그대로 들어갈 것이 있으면 그 이름, 없으면 "none".
${autos}
  - required: 문서에 필수 표시가 있거나 보고서의 핵심 칸이면 true.
  - hint: 칸 옆 작성 요령이 있으면 짧게, 없으면 빈 문자열.
- 서명·직인 칸은 kind text, label에 "(서명)"을 붙여라.
- 문서가 보고 양식이 아니면 title을 빈 문자열로 하고 fields는 빈 배열로 답하라.`;
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
