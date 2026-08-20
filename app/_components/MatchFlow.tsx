"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Donation, NeedMatch } from "@/lib/store";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  cardHighlight,
  caption,
  field,
  label,
  pageDesc,
  pageTitle,
  rankBadge,
  toneBadge,
} from "../ui";
import NeedProgress from "./NeedProgress";

type MatchResult = NeedMatch;

/** 필요도가 낮으면 흐리게. 선택은 가능하되 권하지 않는다는 뜻. */
const NEED_TEXT: Record<string, string> = {
  "매우 필요": "text-primary-700",
  필요: "text-neutral-700",
  여유: "text-neutral-400",
};

/**
 * 2단계: 매칭 확인.
 * 주소(/match/[id])의 물품 id로 물품과 추천 기관을 서버에서 다시 불러온다.
 * 독립 주소라 새로고침·직접 접속에도 대응해야 하므로 앞 단계의 state에 의존하지 않는다.
 */
export default function MatchFlow({ donationId }: { donationId: string }) {
  const router = useRouter();

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [donation, setDonation] = useState<Donation | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  // 기관마다 채우고 싶은 수량이 다를 수 있어 카드별로 따로 들고 있는다.
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const loadMatches = useCallback(async (id: string) => {
    setMatchLoading(true);
    const res = await fetch(`/api/match/${id}`);
    setMatchLoading(false);
    if (!res.ok) return false;
    const data = await res.json();
    setDonation(data.donation);
    setMatches(data.matches);
    setRegions(data.regions);
    return true;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await loadMatches(donationId);
      if (!cancelled) setLoadState(ok ? "ready" : "error");
    })();
    return () => {
      cancelled = true;
    };
  }, [donationId, loadMatches]);

  async function patchDonation(patch: Record<string, unknown>) {
    if (!donation) return;
    await fetch(`/api/donations/${donation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadMatches(donation.id);
  }

  function getQuantity(need: MatchResult) {
    return quantities[need.id] ?? 1;
  }

  function setQuantity(need: MatchResult, value: number) {
    const capped = need.remainingQty > 0 ? Math.min(value, need.remainingQty) : value;
    setQuantities((prev) => ({ ...prev, [need.id]: Math.max(1, capped) }));
  }

  /** 신청 페이지는 또 다른 주소라 넘길 물품·요청 id·수량을 쿼리로 전달한다. */
  function handleSelectNeed(need: MatchResult) {
    if (!donation) return;
    router.push(
      `/apply?donationId=${donation.id}&needId=${need.id}&quantity=${getQuantity(need)}`
    );
  }

  if (loadState === "loading") {
    return <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>;
  }

  if (loadState === "error" || !donation) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-[15px] text-neutral-500">
          등록한 물품 정보를 찾을 수 없어요. 물품 등록부터 다시 시작해주세요
        </p>
        <Link href="/donate" className={btnSecondary}>
          물품 등록하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>어디에 나눔할까요?</h1>
        <p className={pageDesc}>이 물건이 가장 필요한 곳 순으로 정렬했어요</p>
      </header>

      <div className={`${card} mx-auto w-full max-w-lg`}>
        <div className="flex flex-col gap-1.5">
          <label className={label}>품목명</label>
          <p className={`${field} flex items-center bg-neutral-100 text-neutral-700`}>
            {donation.itemName}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={label}>내 지역</label>
          <select
            value={donation.region}
            onChange={(e) => patchDonation({ region: e.target.value })}
            className={field}
          >
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      {matchLoading && <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}

      {!matchLoading && matches.length > 0 && !matches[0].exactMatch && (
        <p className="mx-auto w-full max-w-lg rounded-xl border border-warning-fg/20 bg-warning-bg px-4 py-3 text-[13px] leading-relaxed text-warning-fg">
          {donation.category}를 정확히 요청한 기관이 없어요. 대신 지금 다른 물품을 기다리는 곳을
          보여드릴게요
        </p>
      )}

      {!matchLoading && matches.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8">
          <img
            src="https://picsum.photos/seed/empty-match/240/180"
            alt="매칭된 기관이 없는 상태를 나타내는 이미지"
            className="w-60 rounded-2xl opacity-40 grayscale"
          />
          <p className="text-[15px] text-neutral-400">매칭되는 기관이 없어요</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((need) => (
          <article key={need.id} className={need.rank === 1 ? cardHighlight : card}>
            <div className="flex flex-wrap items-center gap-1.5">
              {need.rank === 1 && <span className={rankBadge}>1순위</span>}
              {need.urgent && <span className={toneBadge("blocked")}>긴급</span>}
            </div>
            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.02em]">{need.itemName}</h2>
              <p className="mt-0.5 text-[13px] text-neutral-500">
                {need.foodBank.name} · {need.distanceKm}km
              </p>
              <p className="text-[13px] text-neutral-400">
                운영일: {need.foodBank.operatingDays.join(", ")}
              </p>
            </div>

            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
            />

            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-neutral-500">필요도</span>
              <span className={NEED_TEXT[need.needLabel]}>
                {need.needScore} · {need.needLabel}
              </span>
            </div>
            <p className="text-[14px] text-neutral-900">{need.needReason}</p>
            {need.note && <p className={caption}>{need.note}</p>}

            <button onClick={() => handleSelectNeed(need)} className={`${btnPrimary} mt-auto`}>
              여기에 나눔하기
            </button>
          </article>
        ))}
      </div>

      <Link href="/donate" className={`${btnGhost} mx-auto`}>
        ← 물품 등록으로 돌아가기
      </Link>
    </div>
  );
}
