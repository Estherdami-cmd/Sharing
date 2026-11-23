// 배분기관(푸드뱅크·푸드마켓 등) 관련 순수 규칙. 서버와 화면이 같이 쓴다.
// store.ts를 끌어오지 않는다 — 클라이언트 번들에 Firestore가 딸려 들어가지 않게.

import { CATEGORIES, distanceKm, parseLocalDate, startOfToday } from "./rules";

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
