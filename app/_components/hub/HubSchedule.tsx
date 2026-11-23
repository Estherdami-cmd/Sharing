"use client";

import type { AllocationSchedule } from "@/lib/hub";
import type { Allocation } from "@/lib/hub-store";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import { OrgMessage } from "../OrgCommon";
import { sectionTitle } from "../../ui";
import { EmptyNote, HubFrame, useHubOverview } from "./HubCommon";
import { GROUP_ORDER, ScheduleCard, type ScheduleActionBody, sortForStatus } from "./Schedule";

type Row = Allocation & {
  id: string;
  schedule: AllocationSchedule;
  intakeId: string;
  itemName: string;
  productImageUrl: string | null;
};

/**
 * 배분 일정 탭. 이 배분기관이 시설에 나눠 준 물품의 전달 일정을 한 곳에서 맞춘다.
 * 시설이 다른 날짜를 요청한 건이 맨 위에 온다 — 배분기관이 답해야 일정이 정해진다.
 */
export default function HubSchedule({ hubId }: { hubId: string }) {
  const admin = useAdminCode();
  const { data, status, reload } = useHubOverview(hubId);

  if (!data) {
    if (status === "loading") return <Loading label="배분 일정" size="lg" overlay />;
    return (
      <OrgMessage
        title={status === "failed" ? "일정을 불러오지 못했어요" : "배분기관을 찾을 수 없어요"}
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );
  }

  const rows: Row[] = data.intakes.flatMap((intake) =>
    intake.allocations
      .filter((a): a is Allocation & { id: string; schedule: AllocationSchedule } => Boolean(a.id && a.schedule))
      .map((a) => ({ ...a, intakeId: intake.id, itemName: intake.itemName, productImageUrl: intake.productImageUrl })),
  );

  async function act(row: Row, body: ScheduleActionBody): Promise<string | null> {
    const res = await admin.adminFetch(
      `/api/intakes/${row.intakeId}/allocations/${row.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      () => act(row, body),
    );
    if (res.status === 401) return "관리 코드를 먼저 확인해주세요";
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? "처리하지 못했어요";
    await reload();
    return null;
  }

  return (
    <HubFrame hubId={hubId} hubCategory={data.hub.category} hubName={data.hub.name} admin={admin}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
        {rows.length === 0 && (
          <EmptyNote>보관 중인 물품을 시설에 배분하면, 전달 일정이 여기에 모여요</EmptyNote>
        )}
        {GROUP_ORDER.hub.map(({ status: s, title }) => {
          const group = sortForStatus(
            s,
            rows.filter((r) => r.schedule.status === s),
          );
          if (group.length === 0) return null;
          return (
            <section key={s} className="flex flex-col gap-3">
              <h2 className={sectionTitle}>
                {title} {group.length}건
              </h2>
              {group.map((row) => (
                <ScheduleCard
                  // 상태가 바뀌면 카드 안 입력 상태도 새로 시작한다.
                  key={`${row.id}-${row.schedule.updatedAt}`}
                  role="hub"
                  title={`${row.itemName} · ${row.qty}개`}
                  subtitle={`${row.beneficiaryName}에 · ${row.needItemName} 요청`}
                  imageUrl={row.productImageUrl}
                  schedule={row.schedule}
                  onAction={(body) => act(row, body)}
                />
              ))}
            </section>
          );
        })}
      </div>
    </HubFrame>
  );
}
