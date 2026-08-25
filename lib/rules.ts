// globalThis를 건드리지 않는 순수 규칙 모듈.
// 서버(라우트)와 클라이언트(단계별 화면들) 양쪽에서 같은 판정 함수를 공유하기 위해 분리했다.

export const CATEGORIES = ["통조림", "세제", "화장지", "위생용품", "쌀/곡물", "기타"];

/** 물품 대분류. 유통기한을 물어봐야 하는지가 여기서 갈린다. */
export type ItemKind = "food" | "nonfood";

export const ITEM_KIND_LABEL: Record<ItemKind, string> = {
  food: "음식",
  nonfood: "음식이 아님",
};

/*
  세부분류는 대분류 안에서만 고르게 한다.

  카테고리 문자열은 기관 요청과 정확히 같아야 매칭된다(store의 matchNeeds가 === 로 본다).
  그래서 이름은 그대로 두고 묶음만 나눴다. "기타"는 양쪽에 둔다 — 씨드 데이터의
  즉석밥 요청이 "기타"를 쓰고 있어서 음식 쪽에 반드시 필요하고, 비음식 쪽도
  담요·학용품처럼 세 분류에 안 맞는 물품을 받을 데가 있어야 한다.
*/
export const FOOD_CATEGORIES = ["통조림", "쌀/곡물", "기타"];
export const NONFOOD_CATEGORIES = ["세제", "화장지", "위생용품", "기타"];

export function categoriesFor(kind: ItemKind): string[] {
  return kind === "food" ? FOOD_CATEGORIES : NONFOOD_CATEGORIES;
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export type Region = { name: string; lat: number; lng: number };

export const REGIONS: Region[] = [
  { name: "북구 죽도동", lat: 36.038, lng: 129.365 },
  { name: "북구 양덕동", lat: 36.073, lng: 129.386 },
  { name: "북구 흥해읍", lat: 36.108, lng: 129.345 },
  { name: "남구 효자동", lat: 36.008, lng: 129.33 },
  { name: "남구 오천읍", lat: 35.966, lng: 129.414 },
];

export const DEFAULT_REGION = "북구 죽도동";

export function getRegion(name: string): Region {
  return REGIONS.find((r) => r.name === name) ?? REGIONS[0];
}

// 위도 36°(포항) 기준 등거리 근사. 시연용이라 하버사인까지는 불필요하다.
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dx = (a.lng - b.lng) * 88.8;
  const dy = (a.lat - b.lat) * 111.0;
  return Math.round(Math.hypot(dx, dy) * 10) / 10;
}

/** 기관이 임의로 켜던 "긴급"을 진행률 기준 자동 판정으로 바꾼다. 기준 미달이면 도움이 필요한 요청. */
export const URGENT_PROGRESS_THRESHOLD = 30;

export function isUrgent(progress: number): boolean {
  return progress < URGENT_PROGRESS_THRESHOLD;
}

/**
 * 한 번에 내놓을 수 있는 개수 상한. 등록 화면에서는 아직 어느 요청에 낼지 모르니
 * 넉넉하게 두고, 요청별 남은 목표라는 진짜 상한은 매칭·신청 화면에서 다시 좁힌다.
 */
export const MAX_DONATION_QUANTITY = 999;

/** 개수는 사용자 입력·주소창·API 어디서든 들어오므로 받는 자리마다 이걸 통과시킨다. */
export function clampQuantity(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_DONATION_QUANTITY);
}

/** 기관이 올리는 요청 하나의 목표 수량 상한. 기부자 개인이 들고 오는 양보다 커도 되니 더 넉넉하게 둔다. */
export const MAX_NEED_TARGET_QTY = 9999;

export function clampTargetQty(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), MAX_NEED_TARGET_QTY);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 형식인지 확인한다. API 경계에서 잘못된 날짜 문자열이 들어오는 걸 막는다. */
export function isValidISODate(value: string): boolean {
  return ISO_DATE.test(value);
}

/**
 * 하이픈을 뺀 전화번호. 휴대폰(010-1234-5678, 011-123-4567 같은 옛 번호 포함)뿐 아니라
 * 서울 지역번호(02), 그 밖의 지역번호(031·051 등), 인터넷전화(070)도 받는다 —
 * 기관 담당자가 유선으로 등록했거나, 기부자가 유선 연락처를 남기고 싶을 수 있다.
 */
const PHONE_DIGITS = /^(01[016789]\d{7,8}|02\d{7,8}|0[3-6]\d{7,8}|070\d{8})$/;

/**
 * 계정이 없는 서비스라 이 번호가 기관이 기부자에게 닿는 유일한 통로다.
 * 한 자리만 적어도 신청이 만들어지면 기관은 물품을 기다리다 못 받는다.
 * 입력 단계에서 이미 숫자만 남기므로 여기서는 자릿수와 앞자리만 본다.
 */
export function isValidPhone(value: string): boolean {
  return PHONE_DIGITS.test(value);
}

/** "YYYY-MM-DD"를 로컬 자정으로 파싱한다. new Date(문자열)은 UTC로 읽혀 KST에서 하루 밀린다. */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-09-04" → "9월 4일". 신청 화면과 완료 화면이 각자 다른 페이지라 여기서 공유한다. */
export function formatKoreanDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** ISO 타임스탬프를 "방금"/"5분 전"/"3시간 전"처럼 사람이 읽는 상대 시간으로 바꾼다. */
export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

/** 기부 물품에 찍힐 수 있는 연도 범위. 이 밖으로 나가면 각인을 잘못 읽은 것으로 본다. */
const EXPIRY_YEAR_BACK = 10;
const EXPIRY_YEAR_AHEAD = 20;

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 실제로 존재하는 날짜인지, 그리고 기부 물품에 찍힐 만한 연도인지 본다. */
function buildDate(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;

  const thisYear = startOfToday().getFullYear();
  if (year < thisYear - EXPIRY_YEAR_BACK || year > thisYear + EXPIRY_YEAR_AHEAD) return null;

  return toISODate(new Date(year, month - 1, day));
}

/** 두 자리 연도는 2000년대로 본다. 식품 라벨에 1900년대가 찍힐 일은 없다. */
function expandYear(twoDigit: number): number {
  return 2000 + twoDigit;
}

/**
 * 연도 없이 월·일만 찍힌 라벨의 연도를 정한다. 오늘에 가장 가까운 해를 고른다.
 *
 * 연도를 생략하는 건 유통기한이 짧은 제품(우유·두부·빵)이다. 그 라벨의 날짜는
 * 오늘에서 몇 주 안쪽이고, 이미 지났을 수도 있다. 그래서 무조건 다음 해로 밀면
 * 안 된다 — 지난 제품이 "나눔 가능"으로 통과해버린다. 8월 20일에 "08.15"를
 * 보면 닷새 지난 것으로 읽어야 맞다.
 *
 * 작년·올해·내년 중 오늘과의 거리가 가장 짧은 후보를 쓴다. 이러면 가까운 과거는
 * 과거로, 먼 과거처럼 보이는 것은 다가오는 날짜로 읽힌다.
 */
function inferYearForMonthDay(month: number, day: number): string | null {
  if (month < 1 || month > 12) return null;

  const today = startOfToday();
  const thisYear = today.getFullYear();

  let best: { iso: string; distance: number } | null = null;
  for (const year of [thisYear - 1, thisYear, thisYear + 1]) {
    if (day < 1 || day > daysInMonth(year, month)) continue; // 2월 29일은 윤년만
    const iso = buildDate(year, month, day);
    if (!iso) continue;
    const distance = Math.abs(parseLocalDate(iso).getTime() - today.getTime());
    if (!best || distance < best.distance) best = { iso, distance };
  }
  return best?.iso ?? null;
}

/**
 * 라벨에 찍힌 날짜 표기를 "YYYY-MM-DD"로 맞춘다. 못 만들면 null.
 *
 * 모델에게 ISO로 달라고 시켜도 라벨 표기를 그대로 옮겨오는 경우가 있어서
 * 서버에서 한 번 더 정규화한다. 잉크젯 각인은 뒤에 시간이나 라인 번호가 붙는 일이
 * 많아("2026.09.04 B4 15:12") 숫자를 아무렇게나 긁어모으면 안 되고, 날짜 모양을
 * 순서대로 맞춰봐야 한다.
 *
 * 연·월만 보이면 그 달의 마지막 날로 본다. 유통기한 표기가 그런 뜻이다.
 *
 * 앞뒤를 가릴 수 없는 표기(예: 03.05.2027 — 3월 5일인지 5월 3일인지)는 추측하지 않고
 * null을 준다. 유통기한을 잘못 읽는 건 못 읽는 것보다 나쁘다.
 */
/**
 * 모델이 준 두 값에서 쓸 수 있는 유통기한을 정한다.
 * iso는 모델이 변환한 값, raw는 라벨에 적힌 문구 그대로다.
 * 모델은 변환이 애매하면 iso를 비우고 raw만 채우라고 지시받았고, 지시를 어기고
 * iso에 라벨 표기를 그대로 넣어오기도 한다. 그래서 둘 다 같은 정규화를 통과시킨다.
 */
export function resolveExpiryDate(iso: string, raw: string): string | null {
  return normalizeExpiryDate(iso) ?? normalizeExpiryDate(raw);
}

export function normalizeExpiryDate(raw: string): string | null {
  if (!raw) return null;

  let s = raw.trim();
  // 시간 표기를 먼저 떼어낸다. 안 그러면 "15:12"의 15가 날짜로 끌려온다.
  s = s.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ");
  // 한국어 표기를 구분자로 바꿔 아래 숫자 패턴이 그대로 잡히게 한다.
  s = s.replace(/[년월]/g, ".").replace(/일/g, " ");

  // 구분자는 점·하이픈·슬래시뿐 아니라 공백일 수도 있다("2027 05 01").
  const SEP = "(?:\\s*[.\\-/]\\s*|\\s+)";

  // 1) 네 자리 연도가 앞: 2027.05.01
  let m = s.match(new RegExp(`(\\d{4})${SEP}(\\d{1,2})${SEP}(\\d{1,2})`));
  if (m) return buildDate(Number(m[1]), Number(m[2]), Number(m[3]));

  // 2) 두 자리 연도가 앞: 27.05.01 — 한국 식품 라벨의 기본형이다.
  m = s.match(new RegExp(`(?<!\\d)(\\d{2})${SEP}(\\d{1,2})${SEP}(\\d{1,2})(?!\\d)`));
  if (m) return buildDate(expandYear(Number(m[1])), Number(m[2]), Number(m[3]));

  // 3) 네 자리 연도가 뒤: 01.05.2027 — 일·월 순서를 가릴 수 있을 때만 받는다.
  m = s.match(new RegExp(`(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{4})`));
  if (m) {
    const [a, b, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a > 12 && b <= 12) return buildDate(year, b, a);
    if (b > 12 && a <= 12) return buildDate(year, a, b);
    return null; // 둘 다 12 이하면 어느 쪽이 월인지 알 수 없다
  }

  // 4) 연·월만: 2027.05 → 그 달 마지막 날
  m = s.match(new RegExp(`(\\d{4})${SEP}(\\d{1,2})(?!${SEP}\\d)(?!\\d)`));
  if (m) {
    const [year, month] = [Number(m[1]), Number(m[2])];
    if (month < 1 || month > 12) return null;
    return buildDate(year, month, daysInMonth(year, month));
  }

  // 5) 월·연 순서: 05/2027 → 그 달 마지막 날
  m = s.match(new RegExp(`(?<!\\d)(\\d{1,2})${SEP}(\\d{4})(?!\\d)`));
  if (m) {
    const [month, year] = [Number(m[1]), Number(m[2])];
    if (month < 1 || month > 12) return null;
    return buildDate(year, month, daysInMonth(year, month));
  }

  // 6) 월·일만: 09.04 → 연도는 오늘에 가장 가까운 해로 추론
  //    앞자리가 13 이상이면 월이 될 수 없다. 그때는 무엇인지 알 수 없어 읽지 않는다.
  m = s.match(new RegExp(`(?<!\\d)(\\d{1,2})${SEP}(\\d{1,2})(?!${SEP}\\d)(?!\\d)`));
  if (m) {
    const [month, day] = [Number(m[1]), Number(m[2])];
    if (month >= 1 && month <= 12) return inferYearForMonthDay(month, day);
    return null;
  }

  // 7) 구분자 없는 각인: 20270501 / 270501
  m = s.match(/(?<!\d)(\d{8})(?!\d)/);
  if (m) {
    const v = m[1];
    return buildDate(Number(v.slice(0, 4)), Number(v.slice(4, 6)), Number(v.slice(6, 8)));
  }
  m = s.match(/(?<!\d)(\d{6})(?!\d)/);
  if (m) {
    const v = m[1];
    return buildDate(expandYear(Number(v.slice(0, 2))), Number(v.slice(2, 4)), Number(v.slice(4, 6)));
  }

  return null;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 받침 유무에 따라 을/를, 이/가 등을 고른다. "통조림를" 같은 어색함 방지. */
/**
 * 기관 요청과 기부 물품이 얼마나 맞는지.
 *
 * 이 값은 정렬과 안내 문구를 고르는 데만 쓴다. 기부자 화면에 "비슷한 품목" 같은
 * 라벨로 띄우지 않는다 — 선의로 물건을 내놓는 사람에게 등급을 매기는 것으로 읽힌다.
 */
export type MatchGrade = "exact" | "similar" | "different";

/** 용량·규격 표기. "즉석밥 210g"의 뒷부분처럼 물건 이름 뒤에 붙는 것들. */
const ITEM_SIZE_SUFFIX = /\d+\s*(kg|g|ml|l|리터|롤|개|매|입|호|팩|봉|포|장)/gi;

/** "즉석밥 210g" → "즉석밥". 물건 이름만 남겨 서로 비교할 수 있게 만든다. */
export function normalizeItemName(name: string): string {
  return name.toLowerCase().replace(ITEM_SIZE_SUFFIX, "").replace(/\s+/g, "");
}

/**
 * 두 품목명이 같은 물건을 가리키는지.
 *
 * 한쪽이 다른 쪽을 포함하면 같다고 본다 — "즉석밥 210g"과 "즉석밥",
 * "백미 5kg"과 "백미 10kg"은 같은 물건이고 용량만 다르다.
 *
 * 자연어 매칭이 아니라 실용적 근사다. "햇반"과 "즉석밥"은 못 잡는다.
 * 틀려도 안내 문구가 달라질 뿐 진행률 규칙은 안 바뀌므로 손해가 작다.
 */
export function isSameItem(a: string, b: string): boolean {
  const x = normalizeItemName(a);
  const y = normalizeItemName(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

export function withJosa(word: string, withFinal: string, withoutFinal: string) {
  const last = word.charCodeAt(word.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? withFinal : withoutFinal}`;
}

export type ShareTone = "ok" | "caution" | "blocked";

/**
 * 유통기한을 어떤 상태로 알고 있는지.
 *
 * null 하나로 "기한 없는 품목"과 "못 읽었음"을 같이 나타내면 안 된다. 앞은
 * 세제·화장지처럼 원래 기한이 없다는 판단이고, 뒤는 아직 아무것도 모른다는
 * 뜻이다. 둘을 뭉개면 못 읽은 물품이 "기한 없음 → 나눔 가능"으로 통과한다.
 *
 * read    날짜를 읽었다
 * none    기한이 없는 품목이다
 * unknown 기한이 있어야 할 물품인데 날짜를 확인하지 못했다 (제조일자만 찍힌 경우 포함)
 */
export type ExpiryStatus = "read" | "none" | "unknown";

export type ShareVerdict = {
  shareable: boolean;
  tone: ShareTone;
  reason: string;
  daysLeft: number | null;
  /** 사용자가 유통기한을 직접 채워야 하는 상태. 나눔 불가와는 다른 뜻이다. */
  needsExpiryInput: boolean;
};

export const TONE_LABEL: Record<ShareTone, string> = {
  ok: "나눔 가능",
  caution: "나눔 주의",
  blocked: "나눔 불가",
};

/** 유통기한이 나눔 가능 여부를 결정한다. 화면1의 핵심 판독 로직. */
/**
 * 나눔 가능 여부를 판정한다. 모델 답이 아니라 항상 이 함수가 정한다.
 *
 * status를 생략하면 날짜가 있으면 read, 없으면 none으로 본다. 이미 날짜가 정해진
 * 기부 기록(store)처럼 "못 읽음"이 있을 수 없는 자리에서 그대로 쓰기 위한 기본값이다.
 */
export function evaluateShareable(
  expiryDate: string | null,
  status: ExpiryStatus = expiryDate ? "read" : "none"
): ShareVerdict {
  if (status === "unknown") {
    return {
      shareable: false,
      tone: "caution",
      reason: "유통기한을 확인하지 못했어요. 포장에 적힌 날짜를 입력해주세요",
      daysLeft: null,
      needsExpiryInput: true,
    };
  }

  if (!expiryDate) {
    return {
      shareable: true,
      tone: "ok",
      reason: "유통기한이 없는 품목이에요. 나눔 가능해요",
      daysLeft: null,
      needsExpiryInput: false,
    };
  }

  const today = startOfToday();
  const expiry = parseLocalDate(expiryDate);
  const daysLeft = Math.round((expiry.getTime() - today.getTime()) / 86400000);

  if (daysLeft < 0) {
    return {
      shareable: false,
      tone: "blocked",
      reason: `유통기한이 ${-daysLeft}일 지났어요. 안전상 나눔이 어려워요`,
      daysLeft,
      needsExpiryInput: false,
    };
  }
  if (daysLeft < 3) {
    return {
      shareable: true,
      tone: "caution",
      reason: `유통기한이 ${daysLeft}일 남았어요. 오늘·내일 전달이면 가능해요`,
      daysLeft,
      needsExpiryInput: false,
    };
  }
  if (daysLeft < 14) {
    return {
      shareable: true,
      tone: "caution",
      reason: `유통기한이 ${daysLeft}일 남았어요. 빠른 전달을 추천해요`,
      daysLeft,
      needsExpiryInput: false,
    };
  }
  return {
    shareable: true,
    tone: "ok",
    reason: `유통기한까지 ${daysLeft}일 남았어요. 나눔 가능해요`,
    daysLeft,
    needsExpiryInput: false,
  };
}

export type SampleItem = {
  key: string;
  label: string;
  itemName: string;
  category: string;
  /** 오늘 기준 오프셋. null이면 유통기한 없는 품목. 날짜를 박아두면 몇 달 뒤 데모가 썩는다. */
  expiryOffsetDays: number | null;
  /**
   * 이 샘플이 나타내는 유통기한 상태. 생략하면 오프셋이 있으면 read, 없으면 none.
   * unknown 샘플이 하나 있어야 "제조일자만 찍힌 라벨" 분기를 API 없이 재현할 수 있다.
   */
  expiryStatus?: ExpiryStatus;
  /** unknown일 때 라벨에서 읽은 제조일자. 오늘 기준 오프셋(음수)로 둔다. */
  manufacturedOffsetDays?: number;
  confidence: number;
  keywords: string[];
};

export const SAMPLE_ITEMS: SampleItem[] = [
  {
    key: "tuna",
    label: "참치 통조림",
    itemName: "참치 통조림 200g",
    category: "통조림",
    expiryOffsetDays: 466,
    confidence: 0.93,
    keywords: ["tuna", "참치", "can", "통조림"],
  },
  {
    key: "rice",
    label: "백미 5kg",
    itemName: "백미 5kg",
    category: "쌀/곡물",
    expiryOffsetDays: 240,
    confidence: 0.9,
    keywords: ["rice", "쌀", "백미", "곡물"],
  },
  {
    key: "detergent",
    label: "세탁세제",
    itemName: "액체 세탁세제 2L",
    category: "세제",
    expiryOffsetDays: null,
    confidence: 0.88,
    keywords: ["detergent", "세제", "세탁"],
  },
  {
    key: "tissue",
    label: "화장지",
    itemName: "3겹 화장지 30롤",
    category: "화장지",
    expiryOffsetDays: null,
    confidence: 0.91,
    keywords: ["tissue", "화장지", "휴지", "롤"],
  },
  {
    key: "diaper",
    label: "성인용 기저귀",
    itemName: "성인용 기저귀 대형",
    category: "위생용품",
    expiryOffsetDays: null,
    confidence: 0.89,
    keywords: ["diaper", "기저귀", "위생"],
  },
  {
    key: "manufactured-only",
    label: "떡국떡 (제조일자만 찍힘)",
    itemName: "떡국떡 1kg",
    category: "기타",
    expiryOffsetDays: null,
    expiryStatus: "unknown",
    manufacturedOffsetDays: -12,
    confidence: 0.82,
    keywords: ["떡", "떡국", "manufactured"],
  },
  {
    key: "juice",
    label: "아침에주스 오렌지 (번들 예시 사진)",
    itemName: "아침에주스 오렌지 210mL",
    category: "기타",
    // public/demo/juice-back.jpg 의 유통기한에 맞춘 값. 날짜를 박으면 데모가 썩는다.
    expiryOffsetDays: 17,
    confidence: 0.96,
    keywords: ["juice", "주스", "orange", "오렌지"],
  },
  {
    key: "yogurt",
    label: "요구르트 (기한 임박)",
    itemName: "요구르트 4입",
    category: "기타",
    expiryOffsetDays: 2,
    confidence: 0.85,
    keywords: ["yogurt", "요구르트", "임박"],
  },
  {
    key: "milk",
    label: "우유 (유통기한 지남)",
    itemName: "흰 우유 1L",
    category: "기타",
    expiryOffsetDays: -3,
    confidence: 0.87,
    keywords: ["milk", "우유", "expired", "만료", "지남"],
  },
];

export function getSample(key: string): SampleItem | undefined {
  return SAMPLE_ITEMS.find((s) => s.key === key);
}

export function findSampleByFileName(fileName: string): SampleItem | undefined {
  const lower = fileName.toLowerCase();
  return SAMPLE_ITEMS.find((s) => s.keywords.some((k) => lower.includes(k.toLowerCase())));
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/** 같은 파일이면 항상 같은 샘플이 나온다. 시연 중 결과가 흔들리지 않게 하는 장치. */
export function pickSampleByHash(fileName: string, fileSize: number): SampleItem {
  return SAMPLE_ITEMS[fnv1a(`${fileName}:${fileSize}`) % SAMPLE_ITEMS.length];
}

export function sampleExpiryDate(sample: SampleItem): string | null {
  if (sample.expiryStatus === "unknown") return null;
  if (sample.expiryOffsetDays === null) return null;
  return toISODate(addDays(startOfToday(), sample.expiryOffsetDays));
}

export function sampleExpiryStatus(sample: SampleItem): ExpiryStatus {
  if (sample.expiryStatus) return sample.expiryStatus;
  return sample.expiryOffsetDays === null ? "none" : "read";
}

export function sampleManufacturedOn(sample: SampleItem): string | null {
  if (sample.manufacturedOffsetDays === undefined) return null;
  return toISODate(addDays(startOfToday(), sample.manufacturedOffsetDays));
}
