"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IMMINENT_DAYS } from "@/lib/hub";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import { OrgMessage } from "../OrgCommon";
import { btnPrimary, card, sectionTitle } from "../../ui";
import {
  DdayBadge,
  EmptyNote,
  HubFrame,
  StageBadge,
  donorLabel,
  hubPath,
  shortDate,
  useHubOverview,
} from "./HubCommon";

function useHub(hubId: string) {
  const admin = useAdminCode();
  const overview = useHubOverview(hubId);
  return { admin, ...overview };
}

function Fallback({ status }: { status: string }) {
  if (status === "loading") return <Loading label="배분기관 현황" size="lg" overlay />;
  return (
    <OrgMessage
      title={status === "failed" ? "현황을 불러오지 못했어요" : "배분기관을 찾을 수 없어요"}
      href="/beneficiary"
      linkLabel="기관 선택으로 돌아가기"
    />
  );
}

/** 입고 탭. 기다리는 입고를 먼저, 처리한 기록은 아래에. */
export function HubIntakes({ hubId }: { hubId: string }) {
  const { admin, data, status } = useHub(hubId);
  if (!data) return <Fallback status={status} />;
  const pending = data.intakes.filter((i) => i.status === "pending");
  const done = data.intakes.filter((i) => i.status !== "pending");

  return (
    <HubFrame hubId={hubId} hubName={data.hub.name} admin={admin}>
      <Link href={`${hubPath(hubId)}/intakes/new`} className={`${btnPrimary} gap-2`}>
        <span aria-hidden>📷</span> 들어온 물품 직접 촬영해 입고
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className={sectionTitle}>입고 대기 {pending.length}건</h2>
        {pending.length === 0 && <EmptyNote>기업·개인이 맡긴 물품이 들어오면 여기에 떠요</EmptyNote>}
        {pending.map((intake) => (
          <IntakeLink key={intake.id} hubId={hubId} intake={intake} />
        ))}
      </section>

      {done.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>처리한 입고</h2>
          {done.map((intake) => (
            <IntakeLink key={intake.id} hubId={hubId} intake={intake} />
          ))}
        </section>
      )}
    </HubFrame>
  );
}

function IntakeLink({
  hubId,
  intake,
}: {
  hubId: string;
  intake: NonNullable<ReturnType<typeof useHubOverview>["data"]>["intakes"][number];
}) {
  return (
    <Link
      href={`${hubPath(hubId)}/intakes/${intake.id}`}
      className={`${card} flex-row! items-center transition-colors hover:border-primary-500`}
    >
      {intake.productImageUrl && (
        <img src={intake.productImageUrl} alt="" className="size-12 shrink-0 rounded-xl border border-neutral-200 object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold">
          {intake.itemName} · {intake.quantity}개
        </p>
        <p className="text-[13px] text-neutral-500">
          {donorLabel(intake)} · {shortDate(intake.createdAt)}
        </p>
      </div>
      <StageBadge intake={intake} />
    </Link>
  );
}

/** 보관·배분 탭. 남은 기한 짧은 순 — 먼저 나가야 할 물건이 위에 온다. */
export function HubStorage({ hubId }: { hubId: string }) {
  const { admin, data, status } = useHub(hubId);
  const params = useSearchParams();
  const justAdded = params.get("new");
  if (!data) return <Fallback status={status} />;

  const stored = data.intakes
    .filter((i) => i.status === "stored")
    .sort(
      (a, b) =>
        Number(a.remainingQty === 0) - Number(b.remainingQty === 0) ||
        (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999),
    );
  const imminent = stored.filter(
    (i) => i.remainingQty > 0 && i.daysLeft !== null && i.daysLeft <= IMMINENT_DAYS,
  );

  return (
    <HubFrame hubId={hubId} hubName={data.hub.name} admin={admin}>
      {justAdded && (
        <p className="rounded-xl bg-success-bg px-4 py-3 text-[14px] font-bold text-success-fg">
          보관으로 옮겼어요. 바로 시설에 나눠 보세요
        </p>
      )}
      {imminent.length > 0 && (
        <p className="rounded-xl border border-warning-fg/20 bg-warning-bg px-4 py-3 text-[14px] font-bold text-warning-fg">
          기한 임박 {imminent.length}건 · {imminent[0].itemName}은(는) {imminent[0].daysLeft}일 안에
          나눠야 해요
        </p>
      )}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className={sectionTitle}>보관 물품</h2>
          <span className="text-xs font-bold text-neutral-500">남은 기한 짧은 순</span>
        </div>
        {stored.length === 0 && <EmptyNote>보관 중인 물품이 없어요. 입고를 승인하면 여기로 와요</EmptyNote>}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {stored.map((intake) => {
            const done = intake.remainingQty === 0;
            const urgent = !done && intake.daysLeft !== null && intake.daysLeft <= IMMINENT_DAYS;
            return (
              <article
                key={intake.id}
                className={
                  (urgent || intake.id === justAdded
                    ? "border-2 border-danger-fg/50 bg-danger-bg/30"
                    : "border border-neutral-200 bg-white") +
                  " flex flex-col gap-3 rounded-2xl p-5" +
                  (done ? " opacity-60" : "")
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[16px] font-bold">
                      {intake.itemName} · {done ? `${intake.quantity}개` : `${intake.remainingQty}개 남음`}
                    </p>
                    <p className="text-[13px] text-neutral-500">
                      입고 {shortDate(intake.approvedAt ?? intake.createdAt)} · {donorLabel(intake)}
                    </p>
                  </div>
                  <DdayBadge expiryDate={intake.expiryDate} />
                </div>
                {done ? (
                  <Link href={`/entrusted/${intake.id}`} className="text-[14px] font-bold text-primary-700">
                    배분 완료 · 결과 보고서 →
                  </Link>
                ) : (
                  <Link
                    href={`${hubPath(hubId)}/intakes/${intake.id}/distribute`}
                    className={
                      "inline-flex h-11 items-center justify-center rounded-xl text-[14px] font-bold " +
                      (urgent
                        ? "bg-danger-fg text-white hover:opacity-90"
                        : "border-2 border-primary-700 bg-white text-primary-700 hover:bg-primary-50")
                    }
                  >
                    배분하기
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </HubFrame>
  );
}
