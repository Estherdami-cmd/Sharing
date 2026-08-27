"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, formatRelativeTime } from "@/lib/rules";
import NeedProgress from "./NeedProgress";
import {
  btnGhost,
  btnPrimary,
  card,
  cardHighlight,
  cardUrgent,
  caption,
  pageDesc,
  pageTitle,
  toneBadge,
} from "../ui";
import { useCountUp } from "./useCountUp";
import { useRefetchOnFocus } from "./useRefetchOnFocus";
import { useToast, ToastViewport } from "./Toast";

type NeedView = {
  id: string;
  itemName: string;
  category: string;
  targetQty: number;
  filledQty: number;
  progress: number;
  remainingQty: number;
  pendingQty: number;
  urgent: boolean;
  note: string;
  imageUrl: string | null;
  createdAt: string;
  foodBank: { name: string; address: string };
};

type SortKey = "default" | "newest" | "almost";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "default", label: "추천순" },
  { key: "newest", label: "최신 등록순" },
  { key: "almost", label: "목표 달성 임박순" },
];

type ActivityItem = {
  id: string;
  quantity: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  donation: { itemName: string };
  foodBank: { name: string };
};

const FILTER_ALL = "전체";
/** 이 진행률을 넘으면 "조금만 더!" 하이라이트에 올라간다. */
const ALMOST_THERE_THRESHOLD = 80;

/**
 * 카드마다 큰 % 숫자에 카운트업을 걸려면 useCountUp을 카드 단위로 호출해야 한다
 * (map 콜백 안에서 훅을 직접 부르면 Rules of Hooks를 어긴다).
 */
function NeedCard({
  need,
  index,
  countUpResetKey,
  onShare,
}: {
  need: NeedView;
  index: number;
  countUpResetKey: unknown;
  onShare: (need: NeedView) => void;
}) {
  const displayedProgress = useCountUp(need.progress, 800, countUpResetKey);

  return (
    <article
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
      className={`${need.urgent ? cardUrgent : card} animate-fade-in-up transition-shadow hover:shadow-lg`}
    >
      <div className="relative -mx-5 -mt-5 mb-1">
        {need.imageUrl ? (
          <img
            src={need.imageUrl}
            alt={`${need.itemName} 사진`}
            className="aspect-4/3 w-full rounded-t-2xl object-cover"
          />
        ) : (
          <div className="flex aspect-4/3 w-full flex-col items-center justify-center gap-1.5 rounded-t-2xl bg-neutral-100">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8 text-neutral-300"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-xs text-neutral-400">사진 없음</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs font-bold text-white">
          {need.category}
        </span>
        <button
          onClick={() => onShare(need)}
          aria-label="이 요청 공유하기"
          className="absolute right-2.5 top-2.5 grid size-8 cursor-pointer place-items-center rounded-full bg-neutral-900/70 text-white transition-colors hover:bg-neutral-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M12 15V4" />
            <path d="M8 8l4-4 4 4" />
            <path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
          </svg>
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-3xl font-extrabold text-primary-700">{displayedProgress}%</span>
        {need.urgent && <span className={toneBadge("caution")}>도움이 필요해요</span>}
      </div>

      <div>
        <h2 className="text-[20px] font-bold tracking-[-0.02em] text-neutral-900">{need.itemName}</h2>
        <p className="mt-0.5 text-xs text-neutral-400">
          {need.foodBank.name} · {need.foodBank.address}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{formatRelativeTime(need.createdAt)} 등록</p>
      </div>

      <NeedProgress
        filledQty={need.filledQty}
        targetQty={need.targetQty}
        progress={need.progress}
        pendingQty={need.pendingQty}
        resetKey={countUpResetKey}
      />

      {need.remainingQty > 0 && (
        <p className="text-[15px] font-semibold text-neutral-900">
          {need.remainingQty.toLocaleString()}개만 더 모으면 목표를 채워요
        </p>
      )}
      {need.note && <p className={caption}>{need.note}</p>}

      <Link href={`/donate?needId=${need.id}`} className={`${btnPrimary} mt-auto`}>
        여기에 나눔하기
      </Link>
    </article>
  );
}

export default function NeedBoard() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터·검색어·정렬을 URL 쿼리에도 반영한다 — 새로고침해도 유지되고, 이 상태
  // 그대로 링크를 복사해서 공유할 수도 있다.
  const [categoryFilter, setCategoryFilterState] = useState(() => {
    const c = searchParams.get("category");
    return c && CATEGORIES.includes(c) ? c : FILTER_ALL;
  });
  const [searchQuery, setSearchQueryState] = useState(() => searchParams.get("q") || "");
  const [sortBy, setSortByState] = useState<SortKey>(() => {
    const s = searchParams.get("sort");
    return SORT_OPTIONS.some((opt) => opt.key === s) ? (s as SortKey) : "default";
  });

  function syncQuery(next: { category?: string; q?: string; sort?: SortKey }) {
    const merged = {
      category: next.category ?? categoryFilter,
      q: next.q ?? searchQuery,
      sort: next.sort ?? sortBy,
    };
    const params = new URLSearchParams();
    if (merged.category !== FILTER_ALL) params.set("category", merged.category);
    if (merged.q) params.set("q", merged.q);
    if (merged.sort !== "default") params.set("sort", merged.sort);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function setCategoryFilter(c: string) {
    setCategoryFilterState(c);
    syncQuery({ category: c });
  }
  function setSearchQuery(q: string) {
    setSearchQueryState(q);
    syncQuery({ q });
  }
  function setSortBy(s: SortKey) {
    setSortByState(s);
    syncQuery({ sort: s });
  }

  const { toast, showToast } = useToast();
  // 새로고침을 직접 눌렀을 때만, 숫자들이 0부터 다시(느긋하게) 올라가는 걸 보여준다.
  const [countUpResetKey, setCountUpResetKey] = useState(0);

  async function shareNeed(need: NeedView) {
    const url = `${window.location.origin}/donate?needId=${need.id}`;
    const shareData = {
      title: `${need.foodBank.name} · ${need.itemName}`,
      text: `${need.itemName} ${need.remainingQty}개만 더 있으면 목표를 채워요!`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // 사용자가 공유를 취소한 경우 등 — 별도 처리 없음
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast("링크가 복사됐어요");
    } catch {
      showToast("링크 복사에 실패했어요", "error");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [needsRes, appsRes] = await Promise.all([fetch("/api/needs"), fetch("/api/applications")]);
      if (!needsRes.ok || !appsRes.ok) throw new Error("failed to load board data");
      setNeeds((await needsRes.json()).needs);
      setActivity(await appsRes.json());
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 기관 관리 창에서 신청을 수락하고 이 탭으로 돌아오면, 열어둔 채 옛 숫자를 보여주지 않게 다시 불러온다.
  useRefetchOnFocus(load);

  // 직접 누른 새로고침에만 토스트로 결과를 알려준다 — 포커스 복귀 등 배경 새로고침까지
  // 알림을 띄우면 탭을 왔다갔다 할 때마다 시끄러워진다.
  const handleRefreshClick = useCallback(async () => {
    const ok = await load();
    setCountUpResetKey((k) => k + 1);
    showToast(
      ok ? "최신 정보로 새로고침했어요" : "새로고침에 실패했어요. 잠시 후 다시 시도해주세요",
      ok ? "success" : "error",
    );
  }, [load, showToast]);

  // 이미 목표를 채운 요청은 "성공 스토리"로 따로 모아 보여주고, 활발히 모금 중인 목록에서는 뺀다.
  const activeNeeds = needs.filter((n) => n.progress < 100);
  const completedNeeds = needs.filter((n) => n.progress >= 100);
  const almostThereNeeds = activeNeeds.filter((n) => n.progress >= ALMOST_THERE_THRESHOLD);

  const acceptedCount = activity.filter((a) => a.status === "accepted").length;
  const recentActivity = activity.filter((a) => a.status !== "rejected").slice(0, 5);

  const totalTarget = needs.reduce((sum, n) => sum + n.targetQty, 0);
  const totalFilled = needs.reduce((sum, n) => sum + n.filledQty, 0);
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredNeeds = activeNeeds
    .filter((n) => categoryFilter === FILTER_ALL || n.category === categoryFilter)
    .filter((n) => !trimmedQuery || n.itemName.toLowerCase().includes(trimmedQuery));
  // "추천순"은 서버가 이미 정해준 순서(도움 필요한 것 먼저)를 그대로 쓴다. 따로 정렬하지 않는다.
  const sortedNeeds =
    sortBy === "newest"
      ? [...filteredNeeds].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      : sortBy === "almost"
        ? [...filteredNeeds].sort((a, b) => b.progress - a.progress)
        : filteredNeeds;
  const isFiltered = categoryFilter !== FILTER_ALL || trimmedQuery.length > 0;
  const displayedTotalFilled = useCountUp(totalFilled, 800, countUpResetKey);

  return (
    <div className="flex flex-col gap-8">
      <ToastViewport toast={toast} />
      <header className="flex flex-col items-center pb-2 pt-1 text-center">
        <h1 className={pageTitle}>지금 필요한 것들</h1>
        <p className={pageDesc}>기관이 올린 목표를 여럿이 나눠 채우고 있어요</p>
        <button
          onClick={handleRefreshClick}
          aria-label="새로고침"
          className={`${btnGhost} mt-1 inline-flex items-center justify-center`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>

        {/*
          이 배너 + 아래 CTA가 "히어로"다. 나머지 섹션(최근 소식·필터·카드 목록)과
          비슷한 무게로 두면 화면이 컴포넌트 나열처럼 복잡해 보인다. 눈에 띄게 크게
          키워서 "일단 이것부터 보고, 나머진 스크롤해서 보는 것"이라는 위계를 준다.

          totalFilled(각 need.filledQty 합)와 acceptedCount(실제 접수된 신청 건수)는
          서로 다른 값이다. 시드 데이터의 filledQty는 신청 없이 박혀있는 값이라
          "N건이 모여 M개를 채웠다"처럼 두 수를 인과로 묶으면 "0건인데 136개"같은
          말이 안 되는 문장이 나온다. 그래서 항상 참인 총량을 주 문구로 쓰고,
          실제 신청 기록이 있을 때만 보조 문장으로 따로 보여준다.
        */}
        {totalTarget > 0 && (
          <div className="mx-auto mt-6 flex w-full max-w-2xl flex-col items-center gap-2 rounded-[28px] bg-primary-50 px-8 py-10 shadow-sm sm:px-12">
            <p className="text-sm font-bold text-primary-700">지금까지의 나눔</p>
            <p className="tabular text-4xl font-extrabold text-neutral-900 sm:text-5xl">
              <span className="text-primary-700">{displayedTotalFilled.toLocaleString()}개</span>가
              모였어요
            </p>
            <p className="tabular text-sm font-semibold text-neutral-500 sm:text-[15px]">
              전체 {totalFilled.toLocaleString()} / {totalTarget.toLocaleString()}개 · 요청{" "}
              {needs.length.toLocaleString()}건
            </p>
            {acceptedCount > 0 && (
              <p className="text-sm text-neutral-500">
                이 중 {acceptedCount}건은 이 서비스를 통해 오갔어요
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col items-center gap-1">
          <Link
            href="/donate"
            className="flex h-16 w-full max-w-sm items-center justify-center rounded-2xl bg-primary-700 px-8 text-[18px] font-extrabold text-white transition-all hover:bg-primary-800 active:scale-[0.98]"
          >
            ＋ 나눔 추가하기
          </Link>
        </div>
      </header>

      {/*
        최근 나눔 소식: "지금 실제로 돌아가는 서비스"라는 느낌을 주는 활동 로그.
        신청 기록이 하나도 없어도(서버가 막 리셋됐을 때 등) 섹션 자체를 숨기지
        않는다 — 통째로 사라지면 화면이 허전해 보인다. 대신 곧 채워질 거라는
        기대를 주는 빈 상태를 보여준다.
      */}
      <section className="flex flex-col gap-2">
        <h2 className="text-center text-[13px] font-bold text-neutral-400">최근 나눔 소식</h2>
        {recentActivity.length > 0 ? (
          <div className="relative">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recentActivity.map((a) => (
                <p
                  key={a.id}
                  className="shrink-0 rounded-full border border-neutral-200 bg-white px-4 py-2 text-[13px] whitespace-nowrap text-neutral-600"
                >
                  <span className="font-bold text-neutral-900">{a.foodBank.name}</span>에{" "}
                  {a.donation.itemName} {a.quantity}개
                  <span className="ml-1.5 text-neutral-400">· {formatRelativeTime(a.createdAt)}</span>
                </p>
              ))}
            </div>
            {/* 가로로 더 스크롤할 게 있다는 걸 은은하게 알려준다. */}
            <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-neutral-50 to-transparent" />
          </div>
        ) : loading ? null : (
          <p className="text-center text-[13px] text-neutral-400">
            아직 나눔 소식이 없어요. 첫 나눔의 주인공이 되어보세요!
          </p>
        )}
      </section>

      {/* 목표 임박 하이라이트: "여럿이 나눠서 채운다"가 가장 눈에 보이는 순간. */}
      {activeNeeds.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl bg-warning-bg/60 p-4">
          <h2 className="text-center text-[15px] font-extrabold text-warning-fg">
            조금만 더 도와주시면 돼요!
          </h2>
          {almostThereNeeds.length > 0 ? (
            <div className="relative">
              {/*
                justify-center로 가운데 모아서, 넓은 화면에서 카드 하나가 왼쪽에
                덩그러니 있고 오른쪽이 텅 비어 보이는 걸 막는다. 그냥 justify-center만
                쓰면 줄이 넘칠 때 스크롤 시작 위치가 콘텐츠 가운데로 잡혀 첫 카드가
                반쯤 잘린 채로 보인다 — safe 키워드가 "다 들어가면 가운데, 넘치면
                왼쪽부터"를 자동으로 골라준다.
              */}
              <div className="flex justify-[safe_center] gap-3 overflow-x-auto pb-1">
                {almostThereNeeds.map((need) => (
                  <article
                    key={need.id}
                    className="flex w-56 shrink-0 flex-col gap-2 rounded-2xl bg-white p-4 transition-shadow hover:shadow-md"
                  >
                    <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                    <h3 className="text-[15px] font-bold tracking-[-0.02em]">{need.itemName}</h3>
                    <NeedProgress
                      filledQty={need.filledQty}
                      targetQty={need.targetQty}
                      progress={need.progress}
                      pendingQty={need.pendingQty}
                      resetKey={countUpResetKey}
                    />
                    <Link href={`/donate?needId=${need.id}`} className={`${btnPrimary} h-11 text-[14px]`}>
                      여기에 나눔하기
                    </Link>
                  </article>
                ))}
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-warning-bg to-transparent" />
            </div>
          ) : (
            <p className="text-center text-[13px] text-warning-fg/70">
              아직 {ALMOST_THERE_THRESHOLD}% 넘게 채워진 요청은 없어요. 조금씩 모이면 여기 뜰 거예요
            </p>
          )}
        </section>
      )}

      {/*
        검색·필터·정렬은 카드가 많아질수록 스크롤해서 다시 위로 올라와야 하는
        번거로움이 커진다. 헤더 바로 아래에 붙여서 목록을 내려보다가도 바로
        조건을 바꿀 수 있게 한다.
      */}
      {/* 직사각형 통 테두리 대신 다른 섹션들과 같은 카드 언어(둥근 모서리 + 그림자)로
          맞춘다 — 딱딱한 상자로 안 보이면서도, 스크롤 중엔 그림자가 떠 있는 패널처럼
          내용 위에 계속 얹혀 있어야 하는 sticky 용도는 그대로 유지된다. */}
      <div className="sticky top-16 z-30 mt-2 flex flex-col gap-3 rounded-2xl bg-neutral-50/95 px-4 py-4 shadow-sm backdrop-blur-md sm:px-6">
        <div className="mx-auto w-full max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="품목명으로 검색 (예: 기저귀)"
            // 이 검색창은 공용 field와 달리 sticky 바 안에 떠 있는 자리라, 폼 입력처럼
            // 진한 테두리로 두면 상자가 붕 떠 보인다. 테두리를 옅게 낮추고 그림자를
            // 얹어 다른 카드들처럼 "떠 있는" 느낌으로 맞춘다.
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-4 text-[15px] text-neutral-900 shadow-sm outline-none transition-colors focus:border-primary-500 focus:ring-4 focus:ring-primary-100"
          />
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {[FILTER_ALL, ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setCategoryFilter(c)}
              className={
                "cursor-pointer rounded-full border px-4 py-2 text-[13px] font-bold transition-colors " +
                (categoryFilter === c
                  ? "border-primary-500 bg-primary-500 text-neutral-900"
                  : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400")
              }
            >
              {c}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[13px] text-neutral-400">
          <span>정렬</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key)}
              className={
                "cursor-pointer rounded-full px-3 py-1 font-bold transition-colors " +
                (sortBy === opt.key ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900")
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isFiltered && sortedNeeds.length > 0 && (
        <p className="-mt-4 text-center text-[13px] text-neutral-400">
          검색 결과 {sortedNeeds.length.toLocaleString()}건
        </p>
      )}

      {/*
        새로고침·포커스 복귀로 다시 불러오는 동안엔 이미 보이던 카드를 그대로 두고
        조용히 갱신한다. loading만 보고 스켈레톤을 띄우면, 이미 떠 있는 실제 카드
        위에 스켈레톤이 겹쳐 순간적으로 두 세트가 동시에 보이게 된다.
      */}
      {loading && needs.length === 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`${card} animate-pulse`}>
              <div className="-mx-5 -mt-5 aspect-4/3 rounded-t-2xl bg-neutral-200" />
              <div className="h-7 w-16 rounded bg-neutral-200" />
              <div className="h-5 w-3/4 rounded bg-neutral-200" />
              <div className="h-4 w-1/2 rounded bg-neutral-200" />
              <div className="h-2.5 w-full rounded-full bg-neutral-200" />
              <div className="h-11 w-full rounded-xl bg-neutral-200" />
            </div>
          ))}
        </div>
      )}

      {!loading && needs.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-8">
          <span className="text-6xl" role="img" aria-label="빈 상자">
            📭
          </span>
          <p className="text-[15px] text-neutral-400">아직 등록된 요청이 없어요</p>
        </div>
      )}

      {!loading && needs.length > 0 && filteredNeeds.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-[15px] text-neutral-400">
            {isFiltered ? "조건에 맞는 요청이 없어요" : "아직 등록된 요청이 없어요"}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sortedNeeds.map((need, i) => (
          <NeedCard
            key={need.id}
            need={need}
            index={i}
            countUpResetKey={countUpResetKey}
            onShare={shareNeed}
          />
        ))}
      </div>

      {/*
        완료된 목표 아카이브: 이 서비스로 실제로 목표가 채워진 적이 있다는 증거.
        아직 하나도 없어도(리셋 직후 등) 섹션을 숨기지 않고, 첫 성공 스토리를
        기다리고 있다는 초대 문구로 대신한다.
      */}
      {needs.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
          <h2 className="text-center text-[15px] font-extrabold text-neutral-700">
            🎉 목표를 채운 요청들
          </h2>
          {completedNeeds.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {completedNeeds.map((need) => (
                <article key={need.id} className={`${cardHighlight} opacity-80`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                    <span className={toneBadge("ok")}>목표 달성</span>
                  </div>
                  <h3 className="text-[17px] font-bold tracking-[-0.02em]">{need.itemName}</h3>
                  <p className="text-[13px] text-neutral-500">
                    {need.targetQty.toLocaleString()}개 목표를 여럿이 나눠서 다 채웠어요
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-center text-[13px] text-neutral-400">
              아직 다 채운 목표는 없어요. 여러분의 나눔이 첫 성공 스토리가 될 수 있어요
            </p>
          )}
        </section>
      )}
    </div>
  );
}
