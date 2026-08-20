"use client";

import Link from "next/link";
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
  field,
  pageDesc,
  pageTitle,
  toneBadge,
} from "../ui";
import { useRefetchOnFocus } from "./useRefetchOnFocus";

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
  foodBank: { name: string; address: string };
};

type ActivityItem = {
  id: string;
  quantity: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  donation: { itemName: string };
  foodBank: { name: string };
};

const FILTER_ALL = "전체";
/** 로그인이 없어 브라우저에만 저장한다. 다른 기기·시크릿창에선 안 보이는 게 맞다. */
const SAVED_STORAGE_KEY = "nanumgotgan:saved-needs";
/** 이 진행률을 넘으면 "조금만 더!" 하이라이트에 올라간다. */
const ALMOST_THERE_THRESHOLD = 80;

export default function NeedBoard() {
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_STORAGE_KEY);
      if (raw) setSavedIds(new Set(JSON.parse(raw)));
    } catch {
      // 저장된 값이 깨져 있으면 그냥 빈 상태로 시작한다.
    }
  }, []);

  function toggleSaved(id: string) {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    const [needsRes, appsRes] = await Promise.all([fetch("/api/needs"), fetch("/api/applications")]);
    if (needsRes.ok) setNeeds((await needsRes.json()).needs);
    if (appsRes.ok) setActivity(await appsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 기관 관리 창에서 신청을 수락하고 이 탭으로 돌아오면, 열어둔 채 옛 숫자를 보여주지 않게 다시 불러온다.
  useRefetchOnFocus(load);

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
    .filter((n) => !trimmedQuery || n.itemName.toLowerCase().includes(trimmedQuery))
    .filter((n) => !savedOnly || savedIds.has(n.id));
  const isFiltered = categoryFilter !== FILTER_ALL || trimmedQuery.length > 0 || savedOnly;

  return (
    <div className="flex flex-col gap-8">
      <header className="text-center">
        <h1 className={pageTitle}>지금 필요한 것들</h1>
        <p className={pageDesc}>기관이 올린 목표를 여럿이 나눠 채우고 있어요</p>

        {/*
          totalFilled(각 need.filledQty 합)와 acceptedCount(실제 접수된 신청 건수)는
          서로 다른 값이다. 시드 데이터의 filledQty는 신청 없이 박혀있는 값이라
          "N건이 모여 M개를 채웠다"처럼 두 수를 인과로 묶으면 "0건인데 136개"같은
          말이 안 되는 문장이 나온다. 그래서 항상 참인 총량을 주 문구로 쓰고,
          실제 신청 기록이 있을 때만 보조 문장으로 따로 보여준다.
        */}
        {totalTarget > 0 && (
          <div className="mx-auto mt-4 flex w-full max-w-lg flex-col items-center gap-1 rounded-2xl bg-primary-50 px-6 py-5">
            <p className="text-xs font-bold text-primary-700">지금까지의 나눔</p>
            <p className="tabular text-2xl font-extrabold text-neutral-900">
              <span className="text-primary-700">{totalFilled}개</span>가 모였어요
            </p>
            {acceptedCount > 0 && (
              <p className="text-[13px] text-neutral-500">
                이 중 {acceptedCount}건은 이 서비스를 통해 오갔어요
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-col items-center gap-1">
          <Link href="/donate" className={`${btnPrimary} max-w-xs`}>
            ＋ 나눔 추가하기
          </Link>
          <button onClick={load} className={btnGhost}>
            새로고침
          </button>
        </div>
      </header>

      {/* 최근 나눔 소식: "지금 실제로 돌아가는 서비스"라는 느낌을 주는 활동 로그. */}
      {recentActivity.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-center text-[13px] font-bold text-neutral-400">최근 나눔 소식</h2>
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
        </section>
      )}

      {/* 목표 임박 하이라이트: "여럿이 나눠서 채운다"가 가장 눈에 보이는 순간. */}
      {almostThereNeeds.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl bg-warning-bg/60 p-4">
          <h2 className="text-center text-[15px] font-extrabold text-warning-fg">
            조금만 더 도와주시면 돼요!
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {almostThereNeeds.map((need) => (
              <article
                key={need.id}
                className="flex w-56 shrink-0 flex-col gap-2 rounded-2xl bg-white p-4"
              >
                <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                <h3 className="text-[15px] font-bold tracking-[-0.02em]">{need.itemName}</h3>
                <NeedProgress
                  filledQty={need.filledQty}
                  targetQty={need.targetQty}
                  progress={need.progress}
                  pendingQty={need.pendingQty}
                />
                <Link href={`/donate?needId=${need.id}`} className={`${btnPrimary} h-11 text-[14px]`}>
                  여기에 나눔하기
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="mx-auto w-full max-w-sm">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="품목명으로 검색 (예: 기저귀)"
          className={field}
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
        <button
          onClick={() => setSavedOnly((v) => !v)}
          className={
            "cursor-pointer rounded-full border px-4 py-2 text-[13px] font-bold transition-colors " +
            (savedOnly
              ? "border-danger-fg bg-danger-bg text-danger-fg"
              : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400")
          }
        >
          ♥ 찜한 것만
        </button>
      </div>

      {loading && <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}

      {!loading && needs.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-8">
          <img
            src="https://picsum.photos/seed/empty-board/240/180"
            alt="등록된 요청이 없는 상태를 나타내는 이미지"
            className="w-60 rounded-2xl opacity-40 grayscale"
          />
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
        {filteredNeeds.map((need) => (
          <article key={need.id} className={need.urgent ? cardUrgent : card}>
            <div className="relative -mx-5 -mt-5 mb-1">
              {need.imageUrl ? (
                <img
                  src={need.imageUrl}
                  alt={`${need.itemName} 사진`}
                  className="aspect-4/3 w-full rounded-t-2xl object-cover"
                />
              ) : (
                <div className="flex aspect-4/3 w-full items-center justify-center rounded-t-2xl bg-neutral-100">
                  <span className="text-xs text-neutral-400">사진 없음</span>
                </div>
              )}
              <span className="absolute left-2.5 top-2.5 rounded-full bg-neutral-900/70 px-2.5 py-1 text-xs font-bold text-white">
                {need.category}
              </span>
              <button
                onClick={() => toggleSaved(need.id)}
                aria-label={savedIds.has(need.id) ? "찜 해제" : "찜하기"}
                className="absolute right-2.5 top-2.5 grid size-9 cursor-pointer place-items-center rounded-full bg-white/90 text-lg text-danger-fg shadow-sm transition-transform active:scale-90"
              >
                {savedIds.has(need.id) ? "♥" : "♡"}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="tabular text-3xl font-extrabold text-primary-700">
                {need.progress}%
              </span>
              {need.urgent && <span className={toneBadge("caution")}>도움이 필요해요</span>}
            </div>

            <div>
              <h2 className="text-[20px] font-bold tracking-[-0.02em] text-neutral-900">
                {need.itemName}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-400">
                {need.foodBank.name} · {need.foodBank.address}
              </p>
            </div>

            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
            />

            {need.remainingQty > 0 && (
              <p className="text-[15px] font-semibold text-neutral-900">
                {need.remainingQty}개만 더 모으면 목표를 채워요
              </p>
            )}
            {need.note && <p className={caption}>{need.note}</p>}

            <Link href={`/donate?needId=${need.id}`} className={`${btnPrimary} mt-auto`}>
              여기에 나눔하기
            </Link>
          </article>
        ))}
      </div>

      {/* 완료된 목표 아카이브: 이 서비스로 실제로 목표가 채워진 적이 있다는 증거. */}
      {completedNeeds.length > 0 && (
        <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
          <h2 className="text-center text-[15px] font-extrabold text-neutral-700">
            🎉 목표를 채운 요청들
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {completedNeeds.map((need) => (
              <article key={need.id} className={`${cardHighlight} opacity-80`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                  <span className={toneBadge("ok")}>목표 달성</span>
                </div>
                <h3 className="text-[17px] font-bold tracking-[-0.02em]">{need.itemName}</h3>
                <p className="text-[13px] text-neutral-500">
                  {need.targetQty}개 목표를 여럿이 나눠서 다 채웠어요
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
