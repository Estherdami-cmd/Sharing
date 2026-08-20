"use client";

import { useEffect, useState } from "react";
import NeedProgress from "./NeedProgress";
import { btnGhost, card, cardUrgent, caption, pageDesc, pageTitle, toneBadge } from "../ui";

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
  foodBank: { name: string; address: string };
};

export default function NeedBoard() {
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [loading, setLoading] = useState(true);

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
        <button onClick={load} className={`${btnGhost} mt-2`}>
          새로고침
        </button>
      </header>

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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {needs.map((need) => (
          <article key={need.id} className={need.urgent ? cardUrgent : card}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                <h2 className="mt-0.5 text-[20px] font-bold tracking-[-0.02em] text-neutral-900">
                  {need.itemName}
                </h2>
                <p className="mt-0.5 text-xs text-neutral-400">
                  {need.category} · {need.foodBank.address}
                </p>
              </div>
              {need.urgent ? (
                <span className={toneBadge("blocked")}>긴급</span>
              ) : need.progress >= 100 ? (
                <span className={toneBadge("ok")}>목표 달성</span>
              ) : null}
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
          </article>
        ))}
      </div>
    </div>
  );
}
