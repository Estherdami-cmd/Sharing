import Link from "next/link";
import { isSameItem } from "@/lib/rules";
import type { ApplicationDetail } from "@/lib/store";
import { caption } from "../ui";

// 목록으로 받을 때는 서버가 연락처를 항상 null로 가려서 보낸다.
export type ApplicationRow = Omit<ApplicationDetail, "contact"> & {
  contact: string | null;
};

export const STATUS_BADGE = {
  pending: { tone: "caution", label: "대기중" },
  accepted: { tone: "ok", label: "수락됨" },
  rejected: { tone: "blocked", label: "거절됨" },
} as const;

export function orgHomePath(orgId: string) {
  return `/beneficiary/${orgId}`;
}

/**
 * 수락하면 진행률이 얼마나 오르는지. 카테고리가 달라 반영되지 않으면 null이다.
 * 다른 신청이 먼저 수락돼 목표가 찼으면 0이다 — 수락해도 실제로는 오르지 않는다.
 */
export function progressGain(app: ApplicationRow): number | null {
  if (!app.need || app.donation.category !== app.need.category) return null;
  return Math.min(app.quantity, app.need.remainingQty);
}

/*
 * 수락 전에 기관이 알아야 할 어긋남. 받을 수 있는 물건인지는 기관만 판단할 수
 * 있으니 돌려 말하지 않는다 — 기부자는 이 화면을 보지 않는다.
 */
export function mismatchNotice(app: ApplicationRow): string | null {
  if (app.status !== "pending" || !app.need) return null;
  if (app.donation.category !== app.need.category) {
    return "카테고리가 달라 수락해도 이 요청의 진행률에는 반영되지 않아요";
  }
  if (!isSameItem(app.donation.itemName, app.need.itemName)) {
    return `'${app.need.itemName}' 요청과 다른 물품이에요. 받으실 수 있는지 확인해주세요`;
  }
  return null;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-1 text-[13px] font-bold text-neutral-500 hover:text-neutral-800"
    >
      <span aria-hidden>←</span>
      {children}
    </Link>
  );
}

/** 주소가 가리키는 대상을 찾지 못했거나 불러오지 못했을 때. 빈 화면 대신 돌아갈 길을 준다. */
export function OrgMessage({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description?: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-[17px] font-bold text-neutral-900">{title}</h1>
      {description && <p className={caption}>{description}</p>}
      <Link
        href={href}
        className="mt-2 text-[14px] font-bold text-primary-700 hover:text-primary-800"
      >
        {linkLabel}
      </Link>
    </div>
  );
}
