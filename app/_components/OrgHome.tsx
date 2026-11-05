"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatKoreanDate } from "@/lib/rules";
import type { Beneficiary, NeedView } from "@/lib/store";
import { needPeriodLabel } from "@/lib/period";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import NeedProgress from "./NeedProgress";
import {
  type ApplicationRow,
  BackLink,
  OrgMessage,
  STATUS_BADGE,
  mismatchNotice,
  orgHomePath,
} from "./OrgCommon";
import { useRefetchOnFocus } from "./useRefetchOnFocus";
import { btnGhost, btnPrimary, caption, card, pageTitle, sectionTitle, toneBadge } from "../ui";

function StatTile({ value, title }: { value: number; title: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-neutral-200 bg-white p-4">
      <span className="text-2xl font-extrabold tracking-[-0.03em] text-neutral-900">{value}</span>
      <span className="break-keep text-xs font-bold text-neutral-500">{title}</span>
    </div>
  );
}

export default function OrgHome({ orgId }: { orgId: string }) {
  const admin = useAdminCode();
  const [org, setOrg] = useState<Beneficiary | null>(null);
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const loadedOnce = useRef(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [needsRes, appsRes] = await Promise.all([
      fetch("/api/needs").catch(() => null),
      fetch("/api/applications").catch(() => null),
    ]);
    setRefreshing(false);
    if (!needsRes?.ok || !appsRes?.ok) {
      // 이미 보고 있는 내용이 있으면 일시적인 실패로 화면을 지우지 않는다.
      if (!loadedOnce.current) setStatus("failed");
      return;
    }
    const needsData: { needs: NeedView[]; beneficiaries: Beneficiary[] } = await needsRes.json();
    const appsData: ApplicationRow[] = await appsRes.json();
    // 요청도 신청도 이 기관 것만 본다. 다른 기관 이름이 섞이면 범위가 어긋난다.
    setOrg(needsData.beneficiaries.find((fb) => fb.id === orgId) ?? null);
    setNeeds(needsData.needs.filter((need) => need.beneficiaryId === orgId));
    setApplications(appsData.filter((app) => app.beneficiaryId === orgId));
    loadedOnce.current = true;
    setStatus("ready");
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // 이 탭을 열어둔 채로 새 신청이 들어와도 탭을 다시 보면 최신 상태가 되게 한다.
  useRefetchOnFocus(load);

  if (status === "loading") return <Loading label="기관 현황" size="lg" overlay />;
  if (status === "failed") {
    return (
      <OrgMessage
        title="기관 현황을 불러오지 못했어요"
        description="잠시 뒤 새로고침해주세요"
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );
  }
  if (!org) {
    return (
      <OrgMessage
        title="기관을 찾을 수 없어요"
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );
  }

  const pending = applications.filter((a) => a.status === "pending");
  const resolvedCount = applications.length - pending.length;
  // 대기중 신청은 처리해야 할 일이고, 끝난 신청은 기록이다. 계속 쌓이는 기록 사이에
  // 방금 들어온 신청이 묻히지 않게, 기본은 대기중만 보여준다.
  const visible = showResolved ? applications : pending;
  const reachedCount = needs.filter((n) => n.filledQty >= n.targetQty).length;

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/beneficiary">기관 선택</BackLink>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`${pageTitle} break-keep`}>{org.name}</h1>
            <button
              onClick={load}
              disabled={refreshing}
              aria-label="새로고침"
              className={`${btnGhost} inline-flex shrink-0 items-center justify-center`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`size-4 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
              >
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
                <path d="M3 21v-5h5" />
              </svg>
            </button>
          </div>
          <div className="mt-2">
            <AdminCodeField {...admin.field} />
          </div>
        </div>
        <Link
          href={`${orgHomePath(orgId)}/needs/new`}
          className={`${btnPrimary} shrink-0 gap-1.5 sm:w-auto sm:px-5`}
        >
          <span aria-hidden className="text-[18px] leading-none">
            +
          </span>
          필요 물품 올리기
        </Link>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <StatTile value={pending.length} title="처리할 신청" />
        <StatTile value={needs.length - reachedCount} title="진행 중인 요청" />
        <StatTile value={reachedCount} title="목표 달성" />
      </div>

      {/* 신청 처리가 기관의 주 업무라 좁은 화면에서는 신청이 먼저 나온다. */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>들어온 신청</h2>
            {resolvedCount > 0 && (
              <button
                onClick={() => setShowResolved((v) => !v)}
                className="cursor-pointer border-none bg-transparent text-xs font-bold text-primary-700 hover:text-primary-800"
              >
                {showResolved ? "대기중만 보기" : `지난 신청도 보기 (${resolvedCount}건)`}
              </button>
            )}
          </div>

          {visible.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-[15px] text-neutral-400">
              {applications.length === 0 ? "아직 들어온 신청이 없어요" : "대기중인 신청이 없어요"}
            </p>
          )}

          {visible.map((app) => {
            const notice = mismatchNotice(app);
            const badge = STATUS_BADGE[app.status];
            return (
              <Link
                key={app.id}
                href={`${orgHomePath(orgId)}/applications/${app.id}`}
                className={`${card} transition-colors hover:border-primary-500`}
              >
                <div className="flex items-start gap-3">
                  {app.donation.productImageUrl && (
                    <img
                      src={app.donation.productImageUrl}
                      alt=""
                      className="size-14 shrink-0 rounded-xl border border-neutral-200 object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-keep text-[15px] font-bold text-neutral-900">
                      {app.donation.itemName} · {app.quantity}개
                    </p>
                    {app.need && (
                      <p className="mt-0.5 break-keep text-[13px] text-primary-700">
                        {app.need.itemName} 요청에 신청
                      </p>
                    )}
                    <p className="mt-1 text-[13px] text-neutral-500">
                      {app.confirmedDate
                        ? `확정 ${formatKoreanDate(app.confirmedDate)} ${app.confirmedSlot}`
                        : `날짜 후보 ${app.candidateDates.length}개`}
                    </p>
                  </div>
                  <span className={toneBadge(badge.tone)}>{badge.label}</span>
                </div>
                {notice && <p className="text-xs text-warning-fg">{notice}</p>}
              </Link>
            );
          })}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>등록한 요청 · 진행률</h2>
          {needs.length === 0 && (
            <p className="rounded-2xl border border-dashed border-neutral-300 px-4 py-6 text-center text-[15px] text-neutral-400">
              아직 올린 요청이 없어요. 위 버튼으로 필요한 물품을 올려보세요
            </p>
          )}
          {needs.map((need) => (
            <article key={need.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 gap-3">
                  {need.imageUrl && (
                    <img
                      src={need.imageUrl}
                      alt={`${need.itemName} 사진`}
                      className="size-14 shrink-0 rounded-xl object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-bold tracking-[-0.02em]">{need.itemName}</h3>
                    <p className="text-xs text-neutral-400">{need.category}</p>
                  </div>
                </div>
                {need.urgent && <span className={toneBadge("caution")}>도움이 필요해요</span>}
              </div>
              <NeedProgress
                filledQty={need.filledQty}
                targetQty={need.targetQty}
                progress={need.progress}
                pendingQty={need.pendingQty}
              />
              {needPeriodLabel(need) && (
                <p className="text-xs text-neutral-500">{needPeriodLabel(need)}</p>
              )}
              {need.note && <p className={caption}>{need.note}</p>}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
