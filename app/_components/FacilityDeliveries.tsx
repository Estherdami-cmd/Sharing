"use client";

import { useCallback, useEffect, useState } from "react";
import type { IncomingDelivery } from "@/lib/hub-store";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import { BackLink, OrgMessage, orgHomePath } from "./OrgCommon";
import { useRefetchOnFocus } from "./useRefetchOnFocus";
import { pageDesc, pageTitle, sectionTitle } from "../ui";
import { EmptyNote } from "./hub/HubCommon";
import { GROUP_ORDER, ScheduleCard, type ScheduleActionBody, sortForStatus } from "./hub/Schedule";

/**
 * 시설 입장의 "받을 물품". 배분기관이 나눠 준 물품의 전달 날짜를 고르고, 받으면 완료로 바꾼다.
 * 개인 기부 신청(들어온 신청)과는 따로 본다 — 상대가 배분기관이고 하는 일이 달라서다.
 */
export default function FacilityDeliveries({ orgId }: { orgId: string }) {
  const admin = useAdminCode();
  const [org, setOrg] = useState<{ id: string; name: string } | null>(null);
  const [rows, setRows] = useState<IncomingDelivery[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound" | "failed">("loading");

  const load = useCallback(async () => {
    const res = await fetch(`/api/deliveries?orgId=${encodeURIComponent(orgId)}`).catch(() => null);
    if (res?.status === 404) return setStatus("notfound");
    if (!res?.ok) return setStatus((s) => (s === "ready" ? s : "failed"));
    const data: { org: { id: string; name: string }; deliveries: IncomingDelivery[] } = await res.json();
    setOrg(data.org);
    setRows(data.deliveries);
    setStatus("ready");
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);
  useRefetchOnFocus(load);

  async function act(row: IncomingDelivery, body: ScheduleActionBody): Promise<string | null> {
    const res = await admin.adminFetch(
      `/api/intakes/${row.intakeId}/allocations/${row.allocation.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
      () => act(row, body),
    );
    if (res.status === 401) return "관리 코드를 먼저 확인해주세요";
    if (!res.ok) return (await res.json().catch(() => null))?.error ?? "처리하지 못했어요";
    await load();
    return null;
  }

  if (status === "loading") return <Loading label="받을 물품" size="lg" overlay />;
  if (status !== "ready" || !org)
    return (
      <OrgMessage
        title={status === "notfound" ? "기관을 찾을 수 없어요" : "받을 물품을 불러오지 못했어요"}
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );

  const withAt = rows.map((r) => ({ ...r, schedule: r.allocation.schedule, at: r.allocation.at }));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6">
      <BackLink href={orgHomePath(orgId)}>{org.name} 홈</BackLink>
      <header className="flex flex-col gap-2">
        <h1 className={`${pageTitle} break-keep`}>받을 물품</h1>
        <p className={`${pageDesc} mt-0!`}>
          배분기관이 나눠 준 물품이에요. 받기 좋은 날짜를 고르거나 다른 날짜를 요청하세요
        </p>
        <AdminCodeField {...admin.field} />
      </header>

      {rows.length === 0 && <EmptyNote>아직 배분기관에서 나눠 준 물품이 없어요</EmptyNote>}

      {GROUP_ORDER.facility.map(({ status: s, title }) => {
        const group = sortForStatus(
          s,
          withAt.filter((r) => r.schedule.status === s),
        );
        if (group.length === 0) return null;
        return (
          <section key={s} className="flex flex-col gap-3">
            <h2 className={sectionTitle}>
              {title} {group.length}건
            </h2>
            {group.map((row) => (
              <ScheduleCard
                key={`${row.allocation.id}-${row.schedule.updatedAt}`}
                role="facility"
                title={`${row.itemName} · ${row.allocation.qty}개`}
                subtitle={`${row.hubName}에서 · ${row.allocation.needItemName} 요청으로`}
                imageUrl={row.productImageUrl}
                schedule={row.schedule}
                onAction={(body) => act(row, body)}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}
