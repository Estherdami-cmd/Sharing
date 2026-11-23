/**
 * 기업 보고 양식. 기업이 쓰는 결과보고서·수령확인서를 올리면 AI가 항목을 뽑아 이 모양으로
 * 만든다. 시설은 이미 아는 값(기관명·품목·수량·날짜…)은 자동으로 채워진 채 빈칸만 쓰고,
 * 결과는 그 기업 양식의 제목·순서 그대로 문서가 된다.
 *
 * 서버·화면 양쪽에서 쓰므로 Firestore나 node 모듈을 들이지 않는다.
 */

/**
 * 칸 종류. 기업 양식에는 체크박스(☐현물 ☐금전), 동의란, 서명란, 기간처럼 글칸이 아닌 것도 있다.
 *   choice  하나 고르기      checks  여러 개 체크      agree  동의 체크 하나
 *   period  기간(시작~끝)    datetime 날짜+시각        sign   서명·직인(온라인 승인 기록으로 대신)
 */
export const FIELD_KINDS = [
  "text", "long", "number", "date", "datetime", "period", "choice", "checks", "agree", "photo", "sign",
] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** 배분 기록으로 자동으로 채울 수 있는 값. AI가 양식 항목을 이 중 하나에 연결한다. */
export const AUTO_KEYS = {
  facilityName: "받은 기관명",
  facilityAddress: "기관 주소",
  facilityCategory: "기관 유형",
  companyName: "기부 기업명",
  hubName: "전달한 배분기관",
  itemName: "품목",
  quantity: "받은 수량",
  requestedQty: "요청했던 수량",
  expiryDate: "소비기한",
  donationKind: "기부 구분(현물)",
  receivedDate: "받은 날짜",
  receivedAt: "받은 일시",
} as const;
export type AutoKey = keyof typeof AUTO_KEYS;

export type FormField = {
  key: string;
  /** 양식에 적힌 칸 코드(예: A1). 없으면 빈 문자열. */
  code: string;
  /** 칸이 속한 구역 이름(예: 기부자, 수령 기관). 문서를 구역별로 나눠 그린다. */
  section: string;
  label: string;
  kind: FieldKind;
  /** choice·checks의 선택지. */
  options: string[];
  /** 누가 채우나. company면 기업이 미리 넣은 값(fixed)을 보여 주고 시설은 손대지 않는다. */
  by: "company" | "recipient";
  /** 기업이 미리 채운 값. */
  fixed: string;
  /** 자동으로 채우는 항목이면 그 값의 종류. 시설은 고칠 수 없다. */
  auto: AutoKey | null;
  required: boolean;
  /** 시설이 쓸 때 칸 아래에 보이는 짧은 안내. */
  hint: string;
};

export type ReportForm = {
  title: string;
  /** 양식 번호(예: TOV-CSR-F01). */
  formCode: string;
  /** 양식 위쪽에 들어가는 안내 문구(있으면). */
  intro: string;
  /** 서명란 위 확인 문구(예: "위 물품을 정히 수령하였음을 확인합니다."). */
  closing: string;
  fields: FormField[];
};

const MAX_FIELDS = 40;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** AI 응답·화면 수정·저장된 값 어디서 왔든 같은 모양으로 맞춘다. 이상한 항목은 버린다. */
export function normalizeForm(raw: unknown): ReportForm | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title, 60);
  if (!title || !Array.isArray(r.fields)) return null;
  const seen = new Set<string>();
  const fields: FormField[] = [];
  for (const f of r.fields) {
    if (!f || typeof f !== "object") continue;
    const x = f as Record<string, unknown>;
    const label = str(x.label, 40);
    if (!label) continue;
    let kind = FIELD_KINDS.includes(x.kind as FieldKind) ? (x.kind as FieldKind) : "text";
    const options = Array.isArray(x.options)
      ? [...new Set(x.options.map((o) => str(o, 30)).filter(Boolean))].slice(0, 10)
      : [];
    // 선택지가 없는 고르기 칸은 글칸으로 받는다.
    if ((kind === "choice" || kind === "checks") && options.length === 0) kind = "text";
    // 종이 양식의 "☐수령 사진 ☐사용 사진"은 체크가 아니라 사진을 붙이라는 뜻이다. 온라인에선 사진 칸으로 받는다.
    if (kind === "checks" && /사진/.test(label) && options.every((o) => /사진/.test(o))) kind = "photo";
    const auto = typeof x.auto === "string" && x.auto in AUTO_KEYS ? (x.auto as AutoKey) : null;
    let key = typeof x.key === "string" && /^[a-zA-Z][a-zA-Z0-9_]{0,30}$/.test(x.key) ? x.key : `f${fields.length + 1}`;
    while (seen.has(key)) key = `${key}_${fields.length + 1}`;
    seen.add(key);
    fields.push({
      key,
      code: str(x.code, 10),
      section: str(x.section, 30),
      label,
      kind,
      options: kind === "photo" ? [] : options,
      by: x.by === "company" ? "company" : "recipient",
      fixed: str(x.fixed, 100),
      auto,
      required: x.required === true,
      hint: str(x.hint, 80),
    });
    if (fields.length >= MAX_FIELDS) break;
  }
  if (fields.length === 0) return null;
  return { title, formCode: str(r.formCode, 30), intro: str(r.intro, 300), closing: str(r.closing, 120), fields };
}

/** 시설이 직접 쓰는 칸인지. 자동·기업 칸은 이미 값이 있다. */
export function isRecipientInput(f: FormField) {
  return !f.auto && f.by !== "company";
}

/**
 * AI 없이 바로 쓰는 예시 양식. OpenAI 한도(시간당 2회)에 걸리거나 시연할 때 쓴다.
 * 기업 사회공헌 결과보고서에 흔히 들어가는 항목으로 만들었다.
 */
export function sampleForm(companyName: string): ReportForm {
  const base = { code: "", section: "", options: [] as string[], by: "recipient" as const, fixed: "" };
  return {
    title: `${companyName} 기부물품 활용 결과보고서`,
    formCode: "",
    intro: "기부해 주신 물품을 어떻게 썼는지 알려주세요. 지속가능경영보고서 사회공헌 실적으로 사용됩니다.",
    closing: "",
    fields: ([
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
    ] as const).map((f) => ({ ...base, ...f })),
  };
}

/** 시설이 쓴 답. 사진 칸은 data URL 배열이다. */
export type FormValues = Record<string, string | string[]>;

/** 한 사람이 올릴 수 있는 사진 수. Firestore 문서 한 개(1MB)에 들어가야 한다. */
export const MAX_PHOTOS = 3;

/** 필수 빈칸 중 아직 안 쓴 것의 이름. 자동 항목은 이미 채워져 있으므로 보지 않는다. */
export function missingRequired(form: ReportForm, values: FormValues): string[] {
  return form.fields
    .filter((f) => f.required && isRecipientInput(f) && f.kind !== "sign")
    .filter((f) => {
      const v = values[f.key];
      return Array.isArray(v) ? v.length === 0 : !String(v ?? "").trim();
    })
    .map((f) => f.label);
}
