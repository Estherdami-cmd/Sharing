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
import { useRefetchOnFocus } from "./useRefetchOnFocus";

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
  // 추천 순위와 별개로, 특정 기관을 알고 있으면 이름으로 바로 찾을 수 있게 한다.
  const [searchQuery, setSearchQuery] = useState("");

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

  useRefetchOnFocus(useCallback(() => {
    loadMatches(donationId);
  }, [donationId, loadMatches]));

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

  // 목표가 남아있으면 그만큼으로, 이미 다 찼으면(여유분 받기) 목표 수량만큼으로
  // 상한을 둔다 — 이미 다 찬 요청엔 상한이 아예 없어서 9999처럼 비상식적인
  // 값도 그대로 입력·전송되던 버그가 있었다.
  function getMaxQuantity(need: MatchResult) {
    return need.remainingQty > 0 ? need.remainingQty : need.targetQty;
  }

  function setQuantity(need: MatchResult, value: number) {
    const capped = Math.min(value, getMaxQuantity(need));
    setQuantities((prev) => ({ ...prev, [need.id]: Math.max(1, capped) }));
  }

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const visibleMatches = trimmedQuery
    ? matches.filter((need) => need.foodBank.name.toLowerCase().includes(trimmedQuery))
    : matches;

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

      {/*
        추천 순위만으로는 원하는 기관이 아래로 밀려있을 수 있다.
        이름으로 바로 찾을 수 있게 검색을 둔다 (카테고리와 안 맞아도 전체 목록에서 찾을 수 있음).
      */}
      {!matchLoading && matches.length > 0 && (
        <div className="mx-auto w-full max-w-lg">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="기관명으로 검색 (예: 사랑의 열매)"
            className={field}
          />
        </div>
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

      {!matchLoading && matches.length > 0 && visibleMatches.length === 0 && (
        <p className="text-center text-[15px] text-neutral-400">
          "{searchQuery}"와 일치하는 기관이 없어요
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleMatches.map((need) => (
          <article key={need.id} className={need.rank === 1 ? cardHighlight : card}>
            <div className="flex flex-wrap items-center gap-1.5">
              {need.rank === 1 && <span className={rankBadge}>1순위</span>}
              {need.urgent && <span className={toneBadge("caution")}>도움이 필요해요</span>}
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

            {/*
              수량은 카드 안에서 고른다. 목표가 기관마다 다르니 "몇 개 낼지"는
              어느 기관을 고를지와 같이 판단하게 되는 값이다.
              남은 목표보다 많이 내겠다고 할 수는 없어서 그 값으로 잠근다.

              임시로 꺼둠 (요청에 의해). 되돌리려면 아래 블록의 주석만 해제하면 됨 —
              getQuantity/setQuantity/getMaxQuantity 함수는 그대로 남겨뒀다.
            */}
            {/*
            <div className="mt-auto flex flex-col gap-1.5">
              <label className={label} htmlFor={`qty-${need.id}`}>
                낼 수량
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(need, getQuantity(need) - 1)}
                  disabled={getQuantity(need) <= 1}
                  aria-label="수량 줄이기"
                  className="size-11 shrink-0 cursor-pointer rounded-xl border-2 border-neutral-300 bg-white text-[18px] font-bold text-neutral-700 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-300"
                >
                  −
                </button>
                <input
                  id={`qty-${need.id}`}
                  type="number"
                  min={1}
                  max={getMaxQuantity(need)}
                  value={getQuantity(need)}
                  onChange={(e) => setQuantity(need, Number(e.target.value))}
                  className={`${field} text-center`}
                />
                <button
                  onClick={() => setQuantity(need, getQuantity(need) + 1)}
                  disabled={getQuantity(need) >= getMaxQuantity(need)}
                  aria-label="수량 늘리기"
                  className="size-11 shrink-0 cursor-pointer rounded-xl border-2 border-neutral-300 bg-white text-[18px] font-bold text-neutral-700 transition-colors hover:border-neutral-400 disabled:cursor-not-allowed disabled:text-neutral-300"
                >
                  +
                </button>
              </div>
              {need.exactMatch ? (
                <p className="text-xs text-neutral-500">
                  {getQuantity(need)}개를 내면 진행률이{" "}
                  <strong className="text-primary-700">
                    {Math.min(
                      100,
                      Math.round(((need.filledQty + getQuantity(need)) / need.targetQty) * 100)
                    )}
                    %
                  </strong>
                  가 돼요
                  {need.remainingQty > 0 && ` · 남은 목표 ${need.remainingQty}개`}
                </p>
              ) : (
                <p className="text-xs text-warning-fg">
                  카테고리가 달라 이 요청의 진행률에는 반영되지 않아요
                </p>
              )}
            </div>
            */}

            <button onClick={() => handleSelectNeed(need)} className={btnPrimary}>
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
