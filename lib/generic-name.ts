import { canonicalItemName } from "./rules";

/**
 * 품목명에서 "일반명"을 뽑는다. 일반명은 용량·상표·수식어를 뺀 물건 이름이다.
 *   "백미 5kg"      → "쌀"
 *   "햇반 210g"     → "즉석밥"
 *   "3겹 화장지 30롤" → "화장지"
 *
 * 왜 필요한가: 매칭에서 "내가 내는 물건"과 "기관이 원하는 물건"이 같은지 판단해야
 * 하는데, 문자열 비교로는 백미와 쌀, 즉석밥과 햇반을 이을 수 없다. rules.ts의
 * 동의어 표가 바닥을 받쳐주지만 손으로 계속 늘려야 한다. 모델은 그걸 안 늘려도 된다.
 *
 * 호출 시점이 중요하다. 매칭 경로에서 부르면 화면을 열 때마다 API를 쓰게 되니,
 * 품목명이 만들어지는 순간(사진 판독·기관의 요청 등록)에 한 번만 계산해서 저장한다.
 * 사진 판독 쪽은 이미 모델을 부르므로 응답 스키마에 필드 하나 더 받으면 공짜다
 * — app/api/recognize/route.ts를 보라. 이 파일은 사진이 없는 경우(기관의 요청
 * 등록, 기존 데이터 백필)를 위한 텍스트 전용 경로다.
 */

const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";
const ENDPOINT = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 20_000;

const SCHEMA = {
  type: "object",
  properties: {
    names: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemName: { type: "string" },
          genericName: { type: "string" },
        },
        required: ["itemName", "genericName"],
        additionalProperties: false,
      },
    },
  },
  required: ["names"],
  additionalProperties: false,
};

const PROMPT = [
  "물품 이름 목록을 받아 각각의 '일반명'을 뽑아라.",
  "",
  "일반명 = 용량·수량·상표·포장 형태·수식어를 모두 뺀, 그 물건을 가리키는 가장 일반적인 한국어 이름.",
  "",
  "예)",
  '  "백미 5kg"           → "쌀"',
  '  "햇반 210g"          → "즉석밥"',
  '  "3겹 화장지 30롤"     → "화장지"',
  '  "액체 세탁세제 2L"    → "세탁세제"',
  '  "떠먹는 요구르트 8개입" → "요구르트"',
  '  "아동용 겨울 점퍼 (110-130)" → "점퍼"',
  '  "성인용 기저귀 대형"   → "기저귀"',
  "",
  "규칙:",
  "- 서로 다른 물건은 서로 다른 일반명이어야 한다. 찹쌀과 백미는 같은 쌀이 아니다 —",
  "  찹쌀은 '찹쌀', 백미는 '쌀'이다. 억지로 묶지 마라.",
  "- 상표명은 일반명으로 바꿔라. 햇반 → 즉석밥.",
  "- 판단이 안 되면 입력 이름에서 용량 표기만 뗀 값을 그대로 써라. 지어내지 마라.",
  "- 입력 순서대로, 입력과 같은 개수로 답하라. itemName은 받은 문자열을 그대로 옮겨라.",
].join("\n");

/**
 * 여러 품목명을 한 번의 호출로 처리한다. 41건 백필도 1회로 끝난다.
 * 실패하면 null이 아니라 결정적 폴백(canonicalItemName)으로 채워 돌려준다 —
 * 일반명이 없으면 매칭이 못 돌아가는 게 아니라 정확도만 낮아지므로, 여기서
 * 예외를 던져 요청 등록 자체를 막는 건 과하다.
 */
export async function deriveGenericNames(itemNames: string[]): Promise<Map<string, string>> {
  const fallback = () => new Map(itemNames.map((n) => [n, canonicalItemName(n)]));
  if (itemNames.length === 0) return new Map();

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[generic-name] OPENAI_API_KEY가 없어 문자열 정규화로 대체");
    return fallback();
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              { type: "input_text", text: JSON.stringify(itemNames, null, 0) },
            ],
          },
        ],
        reasoning: { effort: "low" },
        text: {
          format: { type: "json_schema", name: "generic_names", strict: true, schema: SCHEMA },
        },
      }),
    });

    if (!res.ok) {
      console.error("[generic-name] OpenAI 응답 실패", res.status, (await res.text()).slice(0, 300));
      return fallback();
    }

    const payload = await res.json();
    const text = (Array.isArray(payload?.output) ? payload.output : [])
      .filter((o: { type?: unknown }) => o?.type === "message")
      .flatMap((o: { content?: unknown }) => (Array.isArray(o.content) ? o.content : []))
      .filter((c: { type?: unknown }) => c?.type === "output_text")
      .map((c: { text?: unknown }) => (typeof c.text === "string" ? c.text : ""))
      .join("");

    const parsed = JSON.parse(text) as { names?: { itemName?: string; genericName?: string }[] };
    const out = fallback();
    for (const row of parsed.names ?? []) {
      const key = typeof row.itemName === "string" ? row.itemName : "";
      const value = typeof row.genericName === "string" ? row.genericName.trim() : "";
      // 모델이 입력에 없던 이름을 만들어 왔으면 무시한다. 빈 값도 폴백을 남긴다.
      if (key && value && out.has(key)) out.set(key, value);
    }
    return out;
  } catch (error) {
    console.error("[generic-name] 호출 예외", error);
    return fallback();
  }
}
