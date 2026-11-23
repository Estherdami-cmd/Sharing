"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { type CriteriaCheck, IMMINENT_DAYS, dDayLabel, daysUntil } from "@/lib/hub";
import type { HubOverview, IntakeView } from "@/lib/hub-store";
import { AdminCodeField, useAdminCode } from "../AdminCode";
import { BackLink, orgHomePath } from "../OrgCommon";
import { useRefetchOnFocus } from "../useRefetchOnFocus";
import { pageTitle } from "../../ui";

export const hubPath = orgHomePath;

const TABS = [
  { key: "dashboard", label: "대시보드", suffix: "" },
  { key: "intakes", label: "입고", suffix: "/intakes" },
  { key: "storage", label: "보관·배분", suffix: "/storage" },
  { key: "schedule", label: "배분 일정", suffix: "/schedule" },
  { key: "ledger", label: "장부·보고서", suffix: "/ledger" },
] as const;

/** 배분기관 화면 공통 머리. 기관 이름, 유형 배지, 관리 코드, 탭. */
export function HubFrame({
  hubId,
  hubName,
  hubCategory,
  admin,
  children,
}: {
  hubId: string;
  hubName: string;
  /** 기관 종류. NGO면 배지에 드러낸다. 모르면 그냥 "배분기관". */
  hubCategory?: string;
  admin: ReturnType<typeof useAdminCode>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = hubPath(hubId);
  const active =
    [...TABS].reverse().find((t) => t.suffix && pathname.startsWith(base + t.suffix))?.key ??
    "dashboard";

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print">
        <BackLink href="/beneficiary">기관 선택</BackLink>
      </div>
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className={`${pageTitle} break-keep`}>{hubName}</h1>
          <HubBadge label={hubCategory === "NGO" ? "NGO 배분기관" : undefined} />
        </div>
        <div className="no-print">
          <AdminCodeField {...admin.field} />
        </div>
      </header>
      <nav
        aria-label="배분기관 메뉴"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
      >
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={base + t.suffix}
            aria-current={active === t.key ? "page" : undefined}
            className={
              "inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-[14px] font-bold transition-colors " +
              (active === t.key
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-400")
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}

export function HubBadge({ label = "배분기관" }: { label?: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold whitespace-nowrap text-danger-fg">
      {label}
    </span>
  );
}

/** 대시보드·보관·장부가 같이 쓰는 데이터. 탭을 다시 보면 새로 불러온다. */
export function useHubOverview(hubId: string) {
  const [data, setData] = useState<HubOverview | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "failed">("loading");
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/hubs/${hubId}`).catch(() => null);
    if (!res) {
      if (!loadedOnce.current) setStatus("failed");
      return;
    }
    if (res.status === 404) {
      setStatus("notfound");
      return;
    }
    if (!res.ok) {
      if (!loadedOnce.current) setStatus("failed");
      return;
    }
    setData(await res.json());
    loadedOnce.current = true;
    setStatus("ready");
  }, [hubId]);

  useEffect(() => {
    load();
  }, [load]);
  useRefetchOnFocus(load);

  return { data, status, reload: load };
}

/** 남은 기한 배지. 임박은 빨강, 30일 안쪽은 노랑, 넉넉하거나 기한 없음은 회색. */
export function DdayBadge({ expiryDate }: { expiryDate: string | null }) {
  const days = daysUntil(expiryDate);
  const tone =
    days !== null && days <= IMMINENT_DAYS
      ? "bg-danger-fg text-white"
      : days !== null && days <= 30
        ? "bg-warning-fg text-white"
        : "bg-neutral-400 text-white";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-extrabold whitespace-nowrap ${tone}`}>
      {dDayLabel(expiryDate)}
    </span>
  );
}

export function CriteriaList({ checks }: { checks: CriteriaCheck[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {checks.map((c) => (
        <li key={c.key} className="flex items-start gap-2.5 text-[14px]">
          <span
            aria-hidden
            className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${
              c.ok ? "bg-primary-700" : "bg-warning-fg"
            }`}
          >
            {c.ok ? "✓" : "!"}
          </span>
          <span className="flex-1 text-neutral-800">{c.label}</span>
          <span className={`shrink-0 text-[13px] ${c.ok ? "text-neutral-500" : "font-bold text-warning-fg"}`}>
            {c.detail}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const DONOR_TYPE_LABEL: Record<IntakeView["donorType"], string> = {
  company: "기업",
  individual: "개인",
  walkin: "직접 입고",
};

export function donorLabel(intake: Pick<IntakeView, "donorName" | "donorType">) {
  return intake.donorName || `${DONOR_TYPE_LABEL[intake.donorType]} 기부자`;
}

export function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

export function intakeStage(intake: IntakeView): { label: string; tone: string } {
  if (intake.status === "pending") return { label: "입고 대기", tone: "bg-warning-bg text-warning-fg" };
  if (intake.status === "rejected") return { label: "반려", tone: "bg-neutral-100 text-neutral-500" };
  if (intake.remainingQty === 0) return { label: "배분 완료", tone: "bg-success-bg text-success-fg" };
  if (intake.allocatedQty > 0) return { label: "일부 배분", tone: "bg-primary-100 text-primary-700" };
  return { label: "보관 중", tone: "bg-primary-100 text-primary-700" };
}

export function StageBadge({ intake }: { intake: IntakeView }) {
  const s = intakeStage(intake);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${s.tone}`}>
      {s.label}
    </span>
  );
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-[15px] text-neutral-400">
      {children}
    </p>
  );
}
