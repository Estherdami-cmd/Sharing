"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HUB_CRITERIA, checkHubCriteria, criteriaShortfall } from "@/lib/hub";
import type { DonorType, HubRecommendation } from "@/lib/hub-store";
import type { Donation } from "@/lib/store";
import { field } from "../../ui";

/**
 * 시설을 직접 고르는 대신 가까운 배분기관에 맡기는 길. 기업·개인이 같은 버튼을 쓴다.
 *
 * 배분기관이 받는 기준(최소 수량·남은 기한)에 맞을 때만 열린다. 소량·임박 물품이
 * 배분기관에 들어가면 나눠 줄 곳이 없어 보관하다 폐기된다 — 현장에서 기부가 "짐"이 되는 경로다.
 * 맞지 않으면 숨기지 않고 왜 안 되는지와 다른 길(시설에 직접)을 말한다.
 */
export default function EntrustCard({
  donation,
  hub,
}: {
  donation: Donation;
  hub: HubRecommendation;
}) {
  const router = useRouter();
  const { ok, checks } = checkHubCriteria(donation);
  const [donorType, setDonorType] = useState<DonorType>(donation.quantity >= 20 ? "company" : "individual");
  const [donorName, setDonorName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrust() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/intakes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ donationId: donation.id, hubId: hub.id, donorName, donorType }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "맡기지 못했어요. 다시 시도해주세요");
      setBusy(false);
      return;
    }
    const intake = await res.json();
    router.push(`/entrusted/${intake.id}`);
  }

  if (!ok) {
    return (
      <section className="mx-auto flex w-full max-w-lg flex-col gap-2 rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[14px] font-bold text-neutral-400">{hub.name}에 맡기기</p>
          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-400">
            조건 안 맞음
          </span>
        </div>
        <p className="text-[13px] text-neutral-400">{criteriaShortfall(checks)}</p>
        <p className="rounded-xl bg-warning-bg px-3 py-2 text-[13px] leading-relaxed text-warning-fg">
          이 물품은 아래에서 필요한 시설을 골라 직접 전해 주세요
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-lg flex-col gap-3 rounded-2xl border-2 border-danger-fg/50 bg-danger-bg/40 p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-neutral-500">직접 고르기 어렵다면</p>
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">{hub.name}에 맡기기</h2>
        </div>
        <span className="shrink-0 rounded-full bg-danger-fg px-2.5 py-1 text-xs font-bold text-white">추천</span>
      </div>
      <p className="text-[14px] leading-relaxed text-neutral-700">
        {hub.category} · {hub.distanceKm}km. 맡은 시설 {hub.linkedCount}곳에 필요한 만큼 나눠 드려요.
        {donation.quantity >= 20 && ` ${donation.quantity}개는 한 시설이 다 받기 어려워요.`}
      </p>

      <div className="flex gap-1.5" role="radiogroup" aria-label="기부자 유형">
        {(
          [
            ["company", "기업·단체"],
            ["individual", "개인"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={donorType === key}
            onClick={() => setDonorType(key)}
            className={
              "h-9 flex-1 cursor-pointer rounded-full border text-[13px] font-bold " +
              (donorType === key
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-500")
            }
          >
            {text}
          </button>
        ))}
      </div>
      <input
        value={donorName}
        onChange={(e) => setDonorName(e.target.value)}
        placeholder={donorType === "company" ? "기업·단체 이름 (보고서에 들어가요)" : "이름 (선택)"}
        aria-label="기부자 이름"
        maxLength={40}
        className={field}
      />

      {error && <p className="text-[13px] text-danger-fg">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={entrust}
        className="inline-flex h-13 w-full cursor-pointer items-center justify-center rounded-xl bg-danger-fg text-[15px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? "맡기는 중" : "맡기기"}
      </button>
      <p className="text-center text-xs text-neutral-500">
        받는 기준: {HUB_CRITERIA.acceptsLabel} · {HUB_CRITERIA.minQty}개 이상 · 남은 기한{" "}
        {HUB_CRITERIA.minDaysLeft}일 이상
      </p>
    </section>
  );
}
