/**
 * 기업 보고 양식. 기업이 쓰는 결과보고서·수령확인서를 올리면 AI가 항목을 뽑아 이 모양으로
 * 만든다. 시설은 이미 아는 값(기관명·품목·수량·날짜…)은 자동으로 채워진 채 빈칸만 쓰고,
 * 결과는 그 기업 양식의 제목·순서 그대로 문서가 된다.
 *
 * 서버·화면 양쪽에서 쓰므로 Firestore나 node 모듈을 들이지 않는다.
 */

export const FIELD_KINDS = ["text", "long", "number", "date", "photo"] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** 배분 기록으로 자동으로 채울 수 있는 값. AI가 양식 항목을 이 중 하나에 연결한다. */
export const AUTO_KEYS = {
  facilityName: "받은 기관명",
  facilityAddress: "기관 주소",
  companyName: "기부 기업명",
  hubName: "전달한 배분기관",
  itemName: "품목",
  quantity: "수량",
  receivedDate: "받은 날짜",
} as const;
export type AutoKey = keyof typeof AUTO_KEYS;

export type FormField = {
  key: string;
  label: string;
  kind: FieldKind;
  /** 자동으로 채우는 항목이면 그 값의 종류. 시설은 고칠 수 없다. */
  auto: AutoKey | null;
  required: boolean;
  /** 시설이 쓸 때 칸 아래에 보이는 짧은 안내. */
  hint: string;
};

export type ReportForm = {
  title: string;
  /** 양식 위쪽에 들어가는 안내 문구(있으면). */
  intro: string;
  fields: FormField[];
};

const MAX_FIELDS = 20;

/** AI 응답·화면 수정·저장된 값 어디서 왔든 같은 모양으로 맞춘다. 이상한 항목은 버린다. */
export function normalizeForm(raw: unknown): ReportForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { title?: unknown; intro?: unknown; fields?: unknown };
  const title = typeof r.title === "string" ? r.title.trim().slice(0, 60) : "";
  if (!title || !Array.isArray(r.fields)) return null;
  const seen = new Set<string>();
  const fields: FormField[] = [];
  for (const f of r.fields) {
    if (!f || typeof f !== "object") continue;
    const x = f as Record<string, unknown>;
    const label = typeof x.label === "string" ? x.label.trim().slice(0, 40) : "";
    if (!label) continue;
    const kind = FIELD_KINDS.includes(x.kind as FieldKind) ? (x.kind as FieldKind) : "text";
    const auto = typeof x.auto === "string" && x.auto in AUTO_KEYS ? (x.auto as AutoKey) : null;
    let key = typeof x.key === "string" && /^[a-z][a-zA-Z0-9]{0,30}$/.test(x.key) ? x.key : `f${fields.length + 1}`;
    while (seen.has(key)) key = `${key}_${fields.length + 1}`;
    seen.add(key);
    fields.push({
      key,
      label,
      kind: auto === "receivedDate" ? "date" : auto === "quantity" ? "text" : kind,
      auto,
      required: x.required === true,
      hint: typeof x.hint === "string" ? x.hint.trim().slice(0, 60) : "",
    });
    if (fields.length >= MAX_FIELDS) break;
  }
  if (fields.length === 0) return null;
  return { title, intro: typeof r.intro === "string" ? r.intro.trim().slice(0, 200) : "", fields };
}

/**
 * AI 없이 바로 쓰는 예시 양식. OpenAI 한도(시간당 2회)에 걸리거나 시연할 때 쓴다.
 * 기업 사회공헌 결과보고서에 흔히 들어가는 항목으로 만들었다.
 */
export function sampleForm(companyName: string): ReportForm {
  return {
    title: `${companyName} 기부물품 활용 결과보고서`,
    intro: "기부해 주신 물품을 어떻게 썼는지 알려주세요. 지속가능경영보고서 사회공헌 실적으로 사용됩니다.",
    fields: [
      { key: "facilityName", label: "수혜기관명", kind: "text", auto: "facilityName", required: true, hint: "" },
      { key: "facilityAddress", label: "기관 주소", kind: "text", auto: "facilityAddress", required: false, hint: "" },
      { key: "itemName", label: "기부 물품", kind: "text", auto: "itemName", required: true, hint: "" },
      { key: "quantity", label: "수령 수량", kind: "text", auto: "quantity", required: true, hint: "" },
      { key: "receivedDate", label: "수령일", kind: "date", auto: "receivedDate", required: true, hint: "" },
      { key: "beneficiaries", label: "혜택 인원", kind: "number", auto: null, required: true, hint: "물품을 받은 사람 수" },
      { key: "usage", label: "활용 내용", kind: "long", auto: null, required: true, hint: "언제, 누구에게, 어떻게 나눴는지" },
      { key: "feedback", label: "수혜자 반응·감사 인사", kind: "long", auto: null, required: false, hint: "받은 분들의 한마디" },
      { key: "photo", label: "활용 사진", kind: "photo", auto: null, required: false, hint: "얼굴이 나오지 않게 찍어 주세요" },
      { key: "writer", label: "작성자", kind: "text", auto: null, required: true, hint: "이름과 직책" },
    ],
  };
}

/** 시설이 쓴 답. 사진 칸은 data URL 배열이다. */
export type FormValues = Record<string, string | string[]>;

/** 한 사람이 올릴 수 있는 사진 수. Firestore 문서 한 개(1MB)에 들어가야 한다. */
export const MAX_PHOTOS = 3;

/** 필수 빈칸 중 아직 안 쓴 것의 이름. 자동 항목은 이미 채워져 있으므로 보지 않는다. */
export function missingRequired(form: ReportForm, values: FormValues): string[] {
  return form.fields
    .filter((f) => f.required && !f.auto)
    .filter((f) => {
      const v = values[f.key];
      return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
    })
    .map((f) => f.label);
}
