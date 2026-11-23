// 배분기관(푸드뱅크·푸드마켓 등) 관련 순수 규칙. 서버와 화면이 같이 쓴다.
// store.ts를 끌어오지 않는다 — 클라이언트 번들에 Firestore가 딸려 들어가지 않게.

import {
  CATEGORIES,
  DAY_NAMES,
  distanceKm,
  formatKoreanDate,
  isValidISODate,
  parseLocalDate,
  startOfToday,
} from "./rules";

/**
 * 기관 유형.
 *  - hub      중간 배분기관. 기부를 받아 보관했다가 여러 시설에 나눈다 (푸드뱅크·푸드마켓·NGO)
 *  - facility 최종 수혜 시설. 자기 목표 하나를 올리고 받는다 (지역아동센터·요양원·무료급식소)
 *
 * 따로 저장하지 않고 기관 종류(category)로 정한다. 공공데이터에서 받은 기관 정보를
 * 고쳐 쓰지 않아도 되고, 다시 동기화해도 유형이 어긋나지 않는다.
 */
export type OrgType = "hub" | "facility";

const HUB_CATEGORIES = ["푸드뱅크", "푸드마켓", "NGO"];

type OrgLike = { id: string; category?: string; lat: number; lng: number };

export function orgTypeOf(org: { category?: string } | null | undefined): OrgType {
  return org?.category && HUB_CATEGORIES.includes(org.category) ? "hub" : "facility";
}

export function isHub(org: { category?: string } | null | undefined): boolean {
  return orgTypeOf(org) === "hub";
}

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  hub: "배분기관",
  facility: "시설",
};

/**
 * 시설이 어느 배분기관에 연결돼 있는지. 실제 소속 관계 데이터는 공공데이터에 없어서,
 * 가장 가까운 배분기관을 담당으로 본다. 배분기관이 늘거나 옮겨도 다시 계산된다.
 */
export function nearestHub<T extends OrgLike>(
  facility: { lat: number; lng: number },
  orgs: T[],
): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const org of orgs) {
    if (!isHub(org)) continue;
    const d = distanceKm(facility, org);
    if (d < bestDistance) {
      best = org;
      bestDistance = d;
    }
  }
  return best;
}

/** 이 배분기관이 맡은 시설들. */
export function linkedFacilities<T extends OrgLike>(hubId: string, orgs: T[]): T[] {
  return orgs.filter((o) => !isHub(o) && nearestHub(o, orgs)?.id === hubId);
}

/**
 * 배분기관이 받는 기준. 지금은 모든 배분기관이 같은 기준을 쓴다.
 * 소량은 나눠 줄 곳이 없고, 기한이 짧으면 보관하다 폐기되기 때문이다 —
 * 이 둘이 현장에서 기부가 "짐"이 되는 가장 흔한 경로다.
 */
export const HUB_CRITERIA = {
  minQty: 10,
  minDaysLeft: 30,
  acceptsLabel: "식품 · 생활용품",
};

export type CriteriaCheck = {
  key: "category" | "quantity" | "expiry";
  label: string;
  ok: boolean;
  detail: string;
};

/** 유통기한까지 남은 날. 기한이 없는 품목이면 null. */
export function daysUntil(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = parseLocalDate(expiryDate).getTime() - startOfToday().getTime();
  return Math.round(diff / 86400000);
}

/** "D-5", "D-day", "기한 지남", "기한 없음". */
export function dDayLabel(expiryDate: string | null): string {
  const days = daysUntil(expiryDate);
  if (days === null) return "기한 없음";
  if (days < 0) return "기한 지남";
  if (days === 0) return "D-day";
  return `D-${days}`;
}

/** 이 이하로 남으면 "임박"으로 따로 알린다. */
export const IMMINENT_DAYS = 7;

export function checkHubCriteria(item: {
  category: string;
  quantity: number;
  expiryDate: string | null;
}): { ok: boolean; checks: CriteriaCheck[] } {
  const days = daysUntil(item.expiryDate);
  const checks: CriteriaCheck[] = [
    {
      key: "category",
      label: `받는 품목 (${HUB_CRITERIA.acceptsLabel})`,
      ok: CATEGORIES.includes(item.category),
      detail: item.category,
    },
    {
      key: "quantity",
      label: `최소 수량 ${HUB_CRITERIA.minQty}개 이상`,
      ok: item.quantity >= HUB_CRITERIA.minQty,
      detail: `${item.quantity}개`,
    },
    {
      key: "expiry",
      label: `남은 기한 ${HUB_CRITERIA.minDaysLeft}일 이상`,
      ok: days === null || days >= HUB_CRITERIA.minDaysLeft,
      detail: days === null ? "기한 없는 품목" : days < 0 ? "기한 지남" : `${days}일 남음`,
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

/** 기준에 못 미칠 때 기부자에게 보여줄 한 줄. 무엇이 모자란지 말한다. */
export function criteriaShortfall(checks: CriteriaCheck[]): string {
  return checks
    .filter((c) => !c.ok)
    .map((c) =>
      c.key === "quantity"
        ? `최소 ${HUB_CRITERIA.minQty}개부터 받아요`
        : c.key === "expiry"
          ? `남은 기한 ${HUB_CRITERIA.minDaysLeft}일 이상만 받아요`
          : "받지 않는 품목이에요",
    )
    .join(" · ");
}

/* ───────────────────────── 배분 전달 일정 ─────────────────────────
 * 배분기관이 시설에 나눠 줄 때 전달 방식과 날짜 후보를 보내고, 시설이 하나를 고르거나
 * 다른 날짜를 요청한다. 개인 기부자 ↔ 기관 신청과 같은 흐름이다.
 *
 *   proposed   배분기관이 후보를 보냈다. 시설이 고를 차례
 *   countered  시설이 다른 날짜를 요청했다. 배분기관이 답할 차례
 *   confirmed  날짜가 정해졌다
 *   delivered  전달을 마쳤다
 *
 * 진행률은 배분 확정 때 이미 올라간다(장부·결과 보고서가 그 시점을 기준으로 쓴다).
 * 일정은 "언제 손에 들어오나"를 맞추는 일이라 진행률과 따로 간다.
 */
export type DeliveryMethod = "delivery" | "pickup";
export type ScheduleStatus = "proposed" | "countered" | "confirmed" | "delivered";
export type ScheduleSlot = { date: string; slot: string };

export type AllocationSchedule = {
  method: DeliveryMethod;
  candidates: ScheduleSlot[];
  status: ScheduleStatus;
  confirmedDate: string | null;
  confirmedSlot: string | null;
  /** 시설이 요청한 다른 날짜. 배분기관이 수락하거나 후보를 다시 보내면 지워진다. */
  counter: (ScheduleSlot & { note: string }) | null;
  updatedAt: string;
  deliveredAt: string | null;
};

export const DELIVERY_METHOD_LABEL: Record<DeliveryMethod, string> = {
  delivery: "배분기관이 가져다줘요",
  pickup: "시설이 가지러 가요",
};

export const SCHEDULE_SLOTS = ["오전", "오후", "시간 협의"];
export const MAX_SCHEDULE_CANDIDATES = 3;

export const SCHEDULE_STATUS_BADGE: Record<ScheduleStatus, { label: string; tone: string }> = {
  proposed: { label: "날짜 고르는 중", tone: "bg-warning-bg text-warning-fg" },
  countered: { label: "다른 날짜 요청", tone: "bg-danger-bg text-danger-fg" },
  confirmed: { label: "일정 확정", tone: "bg-primary-100 text-primary-700" },
  delivered: { label: "전달 완료", tone: "bg-success-bg text-success-fg" },
};

/** "11월 27일 (금) 오전" */
export function scheduleLabel(s: ScheduleSlot): string {
  const day = DAY_NAMES[parseLocalDate(s.date).getDay()];
  return `${formatKoreanDate(s.date)} (${day}) ${s.slot}`;
}

/** 오늘 이후 날짜, 정해진 시간대만 남기고 겹치는 건 뺀다. 서버와 화면이 같은 규칙을 쓴다. */
export function normalizeScheduleSlot(raw: unknown): ScheduleSlot | null {
  if (!raw || typeof raw !== "object") return null;
  const { date, slot } = raw as { date?: unknown; slot?: unknown };
  if (typeof date !== "string" || !isValidISODate(date)) return null;
  if (typeof slot !== "string" || !SCHEDULE_SLOTS.includes(slot)) return null;
  if (parseLocalDate(date).getTime() < startOfToday().getTime()) return null;
  return { date, slot };
}

export function normalizeCandidates(raw: unknown): ScheduleSlot[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ScheduleSlot[] = [];
  for (const r of raw) {
    const c = normalizeScheduleSlot(r);
    if (!c) continue;
    const key = `${c.date} ${c.slot}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out.sort((a, b) => a.date.localeCompare(b.date)).slice(0, MAX_SCHEDULE_CANDIDATES);
}
