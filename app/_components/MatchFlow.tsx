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
    // 카드에서 따로 고르지 않았으면 등록 화면에서 적은 개수를 쓴다.
    // 남은 목표보다 많이 적어왔을 수 있으니 여기서도 상한을 씌운다.
    if (quantities[need.id] !== undefined) return quantities[need.id];
    return Math.min(donation?.quantity ?? 1, getMaxQuantity(need));
  }

  // 목표가 남아있으면 그만큼으로, 이미 다 찼으면(여유분 받기) 목표 수량만큼으로
  // 상한을 둔다 — 이미 다 찬 요청엔 상한이 아예 없어서 9999처럼 비상식적인
  // 값도 그대로 입력·전송되던 버그가 있었다.
  function getMaxQuantity(need: MatchResult) {
    return need.remainingQty > 0 ? need.remainingQty : need.targetQty;
  }

  /*
    신청 화면으로 넘길 값은 여기서 자르지 않는다. 기부자가 등록 화면에서 적은 개수가
    남은 목표보다 많으면 줄여야 하는데, 그 사실을 설명하는 자리가 신청 화면이다.
    여기서 미리 잘라 보내면 신청 화면은 줄어든 줄도 모르고 "적은 값이에요"라고 말한다.
  */
  function getIntendedQuantity(need: MatchResult) {
    return quantities[need.id] ?? donation?.quantity ?? 1;
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
      `/apply?donationId=${donation.id}&needId=${need.id}&quantity=${getIntendedQuantity(need)}`
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
        <div className="mx-auto flex w-full max-w-lg flex-col gap-1.5">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="기관명으로 검색 (예: 흥해제일교회)"
            className={field}
          />
          <p className="text-xs text-neutral-400">
            정확히 일치하지 않아도, 비슷한 물건에 가까운 순으로 함께 보여드려요
          </p>
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
              {/* 운영일은 공공데이터에 없다. 대신 실제로 있는 기관 종류를 보여준다. */}
              <p className="text-[13px] text-neutral-400">
                {need.foodBank.operatingDays?.length
                  ? `운영일: ${need.foodBank.operatingDays.join(", ")}`
                  : `${need.foodBank.category ?? "기관"} · 운영일은 신청 후 협의`}
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
            {/*
              exact 등급은 진행 상황을 설명하는 문장(needReason)을 그대로 보여준다.
              similar/different는 카드마다 문장으로 풀면 장황해서, 같은 설명을 검색창
              바로 아래 안내 문구로 한 번만 하고 카드에는 짧은 배지만 남긴다. 배지는
              기부자 개인이 아니라 "이 요청과의 관계"를 가리키므로 선의를 채점하는
              것으로 읽히지 않는다.
            */}
            {need.matchGrade === "exact" ? (
              <p className="text-[14px] text-neutral-900">{need.needReason}</p>
            ) : (
              <span className="inline-flex w-fit items-center rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-bold text-neutral-500">
                {need.matchGrade === "similar" ? "비슷한 분류" : "다른 분류"}
              </span>
            )}
            {need.note && <p className={caption}>{need.note}</p>}

            {/*
              기관별 수량 조절 UI는 임시로 꺼둔 상태(e5eb3e5, 요청에 의해)를 유지한다 —
              개수는 이제 /donate 등록 화면에서 정해지고 여기서는 못 바꾼다.
              다만 "이 개수를 내면 진행률이 몇 %가 되는지" 미리보기는 이 서비스의 핵심
              개념(여럿이 나눠 채운다)을 보여주는 부분이라, 조절 UI 없이 미리보기만 남긴다.
              getQuantity/setQuantity/getMaxQuantity 함수는 조절 UI를 되살릴 때 다시 쓸 수
              있게 그대로 남겨뒀다.
            */}
            <div className="mt-auto flex flex-col gap-1.5">
              {need.matchGrade === "different" ? (
                <p className="text-xs text-neutral-500">
                  이 요청 수치에는 안 들어가지만, 기관에 직접 전달할 수 있어요
                </p>
              ) : (
                <>
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
                  {/* 미리보기를 similar에도 남긴다 — 기관이 수락하면 실제로 반영되므로
                      숨기면 그게 거짓말이 된다. */}
                  {need.matchGrade === "similar" && (
                    <p className="text-xs text-neutral-400">
                      기관에서 확인하고 받아요
                    </p>
                  )}
                </>
              )}
            </div>

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
