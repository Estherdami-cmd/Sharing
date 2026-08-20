"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/rules";
import NeedProgress from "./NeedProgress";
import { btnGhost, btnPrimary, card, cardUrgent, caption, field, pageDesc, pageTitle, toneBadge } from "../ui";

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

const FILTER_ALL = "전체";
/** 로그인이 없어 브라우저에만 저장한다. 다른 기기·시크릿창에선 안 보이는 게 맞다. */
const SAVED_STORAGE_KEY = "nanumgotgan:saved-needs";

export default function NeedBoard() {
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState(FILTER_ALL);
  const [searchQuery, setSearchQuery] = useState("");
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

  async function load() {
    setLoading(true);
    const res = await fetch("/api/needs");
    if (res.ok) setNeeds((await res.json()).needs);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const totalTarget = needs.reduce((sum, n) => sum + n.targetQty, 0);
  const totalFilled = needs.reduce((sum, n) => sum + n.filledQty, 0);
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const filteredNeeds = needs
    .filter((n) => categoryFilter === FILTER_ALL || n.category === categoryFilter)
    .filter((n) => !trimmedQuery || n.itemName.toLowerCase().includes(trimmedQuery));
  const isFiltered = categoryFilter !== FILTER_ALL || trimmedQuery.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className={pageTitle}>지금 필요한 것들</h1>
        <p className={pageDesc}>기관이 올린 목표를 여럿이 나눠 채우고 있어요</p>
        {totalTarget > 0 && (
          <p className="tabular mt-2 text-[15px] font-bold text-primary-700">
            전체 {totalFilled} / {totalTarget}개 · 요청 {needs.length}건
          </p>
        )}
        {/*
          여기서 바로 나눔을 시작할 수 있게 1단계(물품 등록)로 보내는 버튼.
          "추가"만 쓰면 기관이 요청을 추가하는 것으로 읽혀서 "나눔 추가하기"로 적었다.
        */}
        <div className="mt-4 flex flex-col items-center gap-1">
          <Link href="/donate" className={`${btnPrimary} max-w-xs`}>
            ＋ 나눔 추가하기
          </Link>
          <button onClick={load} className={btnGhost}>
            새로고침
          </button>
        </div>
      </header>

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
              {need.urgent ? (
                <span className={toneBadge("caution")}>도움이 필요해요</span>
              ) : need.progress >= 100 ? (
                <span className={toneBadge("ok")}>목표 달성</span>
              ) : null}
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
    </div>
  );
}
