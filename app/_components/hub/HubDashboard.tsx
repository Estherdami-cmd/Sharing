"use client";

import { formatQty } from "@/lib/rules";
import Link from "next/link";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import NeedProgress from "../NeedProgress";
import { OrgMessage } from "../OrgCommon";
import { card, sectionTitle } from "../../ui";
import {
  DdayBadge,
  EmptyNote,
  HubFrame,
  donorLabel,
  hubPath,
  shortDate,
  useHubOverview,
} from "./HubCommon";

function Tile({
  value,
  title,
  tone,
  href,
}: {
  value: number;
  title: string;
  tone: "green" | "red";
  href?: string;
}) {
  const cls =
    "flex flex-col gap-1 rounded-2xl p-4 text-white transition-opacity " +
    (tone === "red" ? "bg-danger-fg" : "bg-primary-700") +
    (href ? " hover:opacity-90" : "");
  const body = (
    <>
      <span className="text-[28px] leading-none font-extrabold tracking-[-0.03em]">{value}</span>
      <span className="text-[13px] font-bold opacity-90">{title}</span>
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/**
 * 배분기관 홈. 맡은 시설 여러 곳의 필요와, 들어와서 기다리는 물품을 한 화면에 본다.
 * 시설 홈(OrgHome)과 같은 진행률 카드를 쓰되 범위가 "우리 시설 하나"에서 "맡은 시설 전체"로 넓다.
 */
export default function HubDashboard({ hubId }: { hubId: string }) {
  const admin = useAdminCode();
  const { data, status } = useHubOverview(hubId);

  if (status === "loading") return <Loading label="배분기관 현황" size="lg" overlay />;
  if (status === "notfound" || !data)
    return (
      <OrgMessage
        title={status === "failed" ? "현황을 불러오지 못했어요" : "배분기관을 찾을 수 없어요"}
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );

  const { hub, facilities, facilityNeeds, intakes } = data;
  const pending = intakes.filter((i) => i.status === "pending");
  const stored = intakes.filter((i) => i.status === "stored" && i.remainingQty > 0);
  const openNeeds = facilityNeeds.filter((n) => n.remainingQty > 0);
  // 시설별로 묶어, 도움이 급한(진행률 낮은) 요청이 위로 오게 한다.
  const needsSorted = [...openNeeds].sort((a, b) => a.progress - b.progress);
  const imminent = stored.filter((i) => i.daysLeft !== null && i.daysLeft <= 7);

  return (
    <HubFrame hubId={hubId} hubCategory={hub.category} hubName={hub.name} admin={admin}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile value={facilities.length} title="담당 시설" tone="green" />
        <Tile value={openNeeds.length} title="진행 중 목표" tone="green" />
        <Tile
          value={pending.length}
          title="입고 대기"
          tone="red"
          href={`${hubPath(hubId)}/intakes`}
        />
        <Tile
          value={stored.length}
          title="보관 물품"
          tone="green"
          href={`${hubPath(hubId)}/storage`}
        />
      </div>

      {imminent.length > 0 && (
        <Link
          href={`${hubPath(hubId)}/storage`}
          className="rounded-xl border border-warning-fg/20 bg-warning-bg px-4 py-3 text-[14px] font-bold text-warning-fg"
        >
          기한 임박 {imminent.length}건 · {imminent[0].itemName}은(는) {imminent[0].daysLeft}일 안에
          나눠야 해요 →
        </Link>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className={sectionTitle}>입고 대기</h2>
            <span className="text-xs font-bold text-neutral-500">기업·개인이 맡김</span>
          </div>
          {pending.length === 0 && <EmptyNote>확인할 입고가 없어요</EmptyNote>}
          {pending.map((intake) => (
            <Link
              key={intake.id}
              href={`${hubPath(hubId)}/intakes/${intake.id}`}
              className="flex items-center gap-3 rounded-2xl border-2 border-danger-fg/40 bg-danger-bg/40 p-4 transition-colors hover:border-danger-fg"
            >
              {intake.productImageUrl && (
                <img
                  src={intake.productImageUrl}
                  alt=""
                  className="size-12 shrink-0 rounded-xl border border-neutral-200 object-cover"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold text-neutral-900">
                  {intake.itemName} · {formatQty(intake.quantity, intake.packing)}
                </p>
                <p className="text-[13px] text-neutral-500">
                  {donorLabel(intake)} · {shortDate(intake.createdAt)} 맡김
                </p>
              </div>
              <span className="inline-flex h-9 shrink-0 items-center rounded-lg bg-danger-fg px-3 text-[13px] font-bold text-white">
                확인
              </span>
            </Link>
          ))}

          {stored.length > 0 && (
            <>
              <h2 className={`${sectionTitle} mt-3`}>보관 중 · 남은 기한 짧은 순</h2>
              {[...stored]
                .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
                .slice(0, 3)
                .map((intake) => (
                  <Link
                    key={intake.id}
                    href={`${hubPath(hubId)}/intakes/${intake.id}/distribute`}
                    className={`${card} flex-row! items-center transition-colors hover:border-primary-500`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold">
                        {intake.itemName} · {formatQty(intake.remainingQty, intake.packing)} 남음
                      </p>
                      <p className="text-[13px] text-neutral-500">{donorLabel(intake)}</p>
                    </div>
                    <DdayBadge expiryDate={intake.expiryDate} />
                  </Link>
                ))}
            </>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className={sectionTitle}>시설별 필요</h2>
            <span className="text-xs font-bold text-neutral-500">
              맡은 시설 {facilities.length}곳 · 요청 {openNeeds.length}건
            </span>
          </div>
          {needsSorted.length === 0 && <EmptyNote>맡은 시설에 진행 중인 요청이 없어요</EmptyNote>}
          {needsSorted.map((need) => (
            <article key={need.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{need.beneficiary.name}</p>
                  <p className="text-[13px] text-neutral-500">
                    {need.itemName} · {need.beneficiary.category ?? "시설"}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-bold text-neutral-500">
                  {need.filledQty}/{need.targetQty}
                </span>
              </div>
              <NeedProgress
                filledQty={need.filledQty}
                targetQty={need.targetQty}
                progress={need.progress}
                pendingQty={need.pendingQty}
                compact
              />
            </article>
          ))}
        </section>
      </div>
    </HubFrame>
  );
}
