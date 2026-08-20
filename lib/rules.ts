// globalThis를 건드리지 않는 순수 규칙 모듈.
// 서버(라우트)와 클라이언트(단계별 화면들) 양쪽에서 같은 판정 함수를 공유하기 위해 분리했다.

export const CATEGORIES = ["통조림", "세제", "화장지", "위생용품", "쌀/곡물", "기타"];

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" 형식인지 확인한다. API 경계에서 잘못된 날짜 문자열이 들어오는 걸 막는다. */
export function isValidISODate(value: string): boolean {
  return ISO_DATE.test(value);
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
export function withJosa(word: string, withFinal: string, withoutFinal: string) {
  const last = word.charCodeAt(word.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0;
  return `${word}${hasFinal ? withFinal : withoutFinal}`;
}

export type ShareTone = "ok" | "caution" | "blocked";

export type ShareVerdict = {
  shareable: boolean;
  tone: ShareTone;
  reason: string;
  daysLeft: number | null;
};

export const TONE_LABEL: Record<ShareTone, string> = {
  ok: "나눔 가능",
  caution: "나눔 주의",
  blocked: "나눔 불가",
};

/** 유통기한이 나눔 가능 여부를 결정한다. 화면1의 핵심 판독 로직. */
export function evaluateShareable(expiryDate: string | null): ShareVerdict {
  if (!expiryDate) {
    return {
      shareable: true,
      tone: "ok",
      reason: "유통기한이 없는 품목이에요. 나눔 가능해요",
      daysLeft: null,
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
    };
  }
  if (daysLeft < 3) {
    return {
      shareable: true,
      tone: "caution",
      reason: `유통기한이 ${daysLeft}일 남았어요. 오늘·내일 전달이면 가능해요`,
      daysLeft,
    };
  }
  if (daysLeft < 14) {
    return {
      shareable: true,
      tone: "caution",
      reason: `유통기한이 ${daysLeft}일 남았어요. 빠른 전달을 추천해요`,
      daysLeft,
    };
  }
  return {
    shareable: true,
    tone: "ok",
    reason: `유통기한까지 ${daysLeft}일 남았어요. 나눔 가능해요`,
    daysLeft,
  };
}

export type SampleItem = {
  key: string;
  label: string;
  itemName: string;
  category: string;
  /** 오늘 기준 오프셋. null이면 유통기한 없는 품목. 날짜를 박아두면 몇 달 뒤 데모가 썩는다. */
  expiryOffsetDays: number | null;
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
  if (sample.expiryOffsetDays === null) return null;
  return toISODate(addDays(startOfToday(), sample.expiryOffsetDays));
}
