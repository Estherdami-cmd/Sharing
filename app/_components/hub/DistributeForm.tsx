"use client";

import { formatQty } from "@/lib/rules";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DistributionCandidate, IntakeView } from "@/lib/hub-store";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import NeedProgress from "../NeedProgress";
import { OrgMessage } from "../OrgCommon";
import { btnGhost, btnPrimary, caption, card } from "../../ui";
import { DdayBadge, HubFrame, donorLabel, hubPath } from "./HubCommon";
import { CandidatePicker, defaultCandidate } from "./Schedule";
import type { DeliveryMethod, ScheduleSlot } from "@/lib/hub";

/**
 * 수량 나눠 배분. 시스템이 필요한 시설과 수량을 먼저 채워 두고(먼저 요청한 곳부터),
 * 기관은 숫자만 고쳐서 확정한다. 확정하면 각 시설 게이지가 그 자리에서 차오른다.
 * 확정할 때 전달 방식과 날짜 후보를 같이 보낸다 — 시설이 그중 하나를 골라 일정이 정해진다.
 */
export default function DistributeForm({ hubId, intakeId }: { hubId: string; intakeId: string }) {
  const admin = useAdminCode();
  const [intake, setIntake] = useState<IntakeView | null>(null);
  const [candidates, setCandidates] = useState<DistributionCandidate[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 확정한 뒤에는 같은 카드에서 게이지를 새 값으로 올려 보여준다.
  const [done, setDone] = useState(false);
  const [method, setMethod] = useState<DeliveryMethod>("delivery");
  const [slots, setSlots] = useState<ScheduleSlot[]>([defaultCandidate(1), defaultCandidate(2)]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/intakes/${intakeId}/distribute`).catch(() => null);
    if (!res?.ok) {
      setStatus("notfound");
      return;
    }
    const data: { intake: IntakeView; candidates: DistributionCandidate[] } = await res.json();
    setIntake(data.intake);
    setCandidates(data.candidates);
    setQty(Object.fromEntries(data.candidates.map((c) => [c.id, c.suggestedQty])));
    setStatus("ready");
  }, [intakeId]);

  useEffect(() => {
    load();
  }, [load]);

  async function confirm() {
    if (!intake) return;
    setBusy(true);
    setError(null);
    const allocations = candidates
      .filter((c) => (qty[c.id] ?? 0) > 0)
      .map((c) => ({ needId: c.id, qty: qty[c.id] }));
    const res = await admin.adminFetch(
      `/api/intakes/${intakeId}/distribute`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allocations, schedule: { method, candidates: slots } }),
      },
      confirm,
    );
    setBusy(false);
    if (res.status === 401) return;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "배분하지 못했어요");
      return;
    }
    setIntake(body);
    // 서버에 다시 묻지 않고 방금 나눈 만큼 올린다 — 게이지가 지금 값에서 새 값으로 차오르게.
    setCandidates((prev) =>
      prev.map((c) => {
        const add = qty[c.id] ?? 0;
        const filledQty = Math.min(c.targetQty, c.filledQty + add);
        const progress =
          filledQty >= c.targetQty ? 100 : Math.min(99, Math.round((filledQty / c.targetQty) * 100));
        return { ...c, filledQty, progress, remainingQty: c.targetQty - filledQty };
      }),
    );
    setDone(true);
  }

  if (status === "loading") return <Loading label="받을 시설" size="lg" overlay />;
  if (status === "notfound" || !intake || intake.hubId !== hubId)
    return <OrgMessage title="입고 기록을 찾을 수 없어요" href={hubPath(hubId)} linkLabel="대시보드로" />;

  const total = Object.values(qty).reduce((s, n) => s + (n || 0), 0);
  const available = done ? intake.allocatedQty : intake.remainingQty;
  const over = !done && total > intake.remainingQty;
  const shown = done ? candidates.filter((c) => (qty[c.id] ?? 0) > 0) : candidates;

  return (
    <HubFrame hubId={hubId} hubName={intake.hubName} admin={admin}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">
          {done ? "배분했어요 · 시설 게이지가 올랐어요" : "배분하기"}
        </h2>

        <section className={`${card} flex-row! items-center`}>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold">
              {intake.itemName} · {done ? `${intake.allocatedQty}개 배분` : formatQty(intake.remainingQty, intake.packing)}
            </p>
            <p className={caption}>
              {done
                ? intake.remainingQty > 0
                  ? `${intake.remainingQty}개는 보관 중이에요`
                  : "남은 물품 없이 모두 나눴어요"
                : `${donorLabel(intake)} · 필요한 시설을 먼저 요청한 순으로 찾았어요`}
            </p>
          </div>
          <DdayBadge expiryDate={intake.expiryDate} />
        </section>

        {!done && candidates.length === 0 && (
          <p className="rounded-xl bg-warning-bg px-4 py-3 text-[14px] text-warning-fg">
            지금 {intake.category}을(를) 기다리는 시설 요청이 없어요. 보관해 두고 요청이 오면 나눠요
          </p>
        )}

        <div className="flex flex-col gap-2.5">
          {!done && candidates.length > 0 && (
            <div className="flex items-center justify-between px-1 text-xs font-bold text-neutral-500">
              <span>받을 시설</span>
              <span>필요 수량 기준</span>
            </div>
          )}
          {shown.map((c, i) => (
            <article key={c.id} className="flex flex-col gap-2.5 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{c.beneficiary.name}</p>
                  <p className="text-[13px] text-neutral-500">
                    {c.itemName} · 필요 {c.remainingQty + (done ? qty[c.id] ?? 0 : 0)}
                    {i === 0 && !done && (
                      <span className="font-bold text-danger-fg"> · 먼저 요청함</span>
                    )}
                    {!c.linked && <span className="text-neutral-400"> · 다른 권역</span>}
                  </p>
                </div>
                {done ? (
                  <span className="shrink-0 text-[15px] font-extrabold text-primary-700">+{qty[c.id]}</span>
                ) : (
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={c.remainingQty}
                    aria-label={`${c.beneficiary.name}에 보낼 수량`}
                    value={qty[c.id] ?? 0}
                    onChange={(e) => {
                      const n = Math.max(0, Math.min(c.remainingQty, Math.floor(Number(e.target.value) || 0)));
                      setQty((prev) => ({ ...prev, [c.id]: n }));
                    }}
                    className="h-11 w-20 shrink-0 rounded-xl border-2 border-primary-500 bg-primary-50 text-center text-[16px] font-extrabold text-neutral-900 outline-none focus:border-primary-700"
                  />
                )}
              </div>
              {done && (
                <NeedProgress filledQty={c.filledQty} targetQty={c.targetQty} progress={c.progress} compact />
              )}
            </article>
          ))}
        </div>

        {!done && candidates.length > 0 && (
          <>
            <div className="flex flex-col gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-center justify-between text-[14px] font-bold">
                <span>배분 합계</span>
                <span className={over ? "text-danger-fg" : "text-primary-700"}>
                  {total} / {intake.remainingQty}개
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full transition-all ${over ? "bg-danger-fg" : "bg-primary-700"}`}
                  style={{ width: `${Math.min(100, (total / Math.max(1, available)) * 100)}%` }}
                />
              </div>
              {over && <p className="text-[13px] text-danger-fg">남은 수량보다 많아요</p>}
            </div>
            <section className={card}>
              <div>
                <h3 className="text-[16px] font-bold">전달 일정 후보</h3>
                <p className={caption}>시설마다 이 중 편한 날을 고르거나, 다른 날짜를 요청할 수 있어요</p>
              </div>
              <CandidatePicker
                method={method}
                onMethodChange={setMethod}
                candidates={slots}
                onCandidatesChange={setSlots}
              />
            </section>
            {error && <p className="text-[14px] text-danger-fg">{error}</p>}
            <button
              type="button"
              disabled={busy || total === 0 || over || slots.length === 0}
              onClick={confirm}
              className={btnPrimary}
            >
              {busy ? "배분 중" : "배분 확정 · 시설에 일정 보내기"}
            </button>
            <p className="text-center text-xs text-neutral-500">확정하면 각 시설 게이지가 차오르고, 시설에 날짜 후보가 가요</p>
          </>
        )}

        {done && (
          <div className="flex flex-col gap-2">
            <p className="rounded-xl bg-primary-50 px-4 py-3 text-[14px] text-primary-700">
              시설에 날짜 후보를 보냈어요. 시설이 고르면 배분 일정에서 확정돼요
            </p>
            <Link href={`${hubPath(hubId)}/schedule`} className={btnPrimary}>
              배분 일정 보기
            </Link>
            <Link href={`/entrusted/${intake.id}`} className={`${btnGhost} text-center`}>
              결과 보고서 보기
            </Link>
            <Link href={`${hubPath(hubId)}/ledger`} className={`${btnGhost} text-center`}>
              장부에서 보기
            </Link>
          </div>
        )}
      </div>
    </HubFrame>
  );
}
