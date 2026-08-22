"use client";

/**
 * 이 서비스에서 가장 많이 반복되는 요소라 별도 컴포넌트로 뺐다.
 * 낮은 진행률에 빨강을 쓰는 건 의도적이다 — 0%가 회색이면 "아무도 관심 없는 요청"으로
 * 보이지만, 빨강이면 "여기가 제일 급하다"로 읽힌다.
 */

import { useEffect, useState } from "react";
import { useCountUp } from "./useCountUp";

function fillClass(progress: number) {
  if (progress >= 100) return "bg-success-fg";
  if (progress >= 60) return "bg-primary-600";
  if (progress >= 30) return "bg-primary-500";
  return "bg-danger-fg";
}

function textClass(progress: number) {
  if (progress >= 100) return "text-success-fg";
  if (progress >= 60) return "text-primary-700";
  if (progress >= 30) return "text-primary-700";
  return "text-danger-fg";
}

export default function NeedProgress({
  filledQty,
  targetQty,
  progress,
  pendingQty = 0,
  resetKey,
}: {
  filledQty: number;
  targetQty: number;
  progress: number;
  pendingQty?: number;
  /** 값이 바뀔 때만 카운트업을 0부터 다시(느리게) 재생하고 싶을 때(예: 새로고침) 넘긴다. */
  resetKey?: unknown;
}) {
  const pendingWidth = Math.min(100 - progress, Math.round((pendingQty / targetQty) * 100));

  // 바가 뜨자마자 최종 길이로 딱 나타나지 않고, 0에서 실제 값까지 채워지며 나타나게 한다.
  const [barWidth, setBarWidth] = useState(0);
  // progress가 정확히 0이면 barWidth도 계속 0이라, "barWidth가 채워진 뒤에 대기중
  // 줄무늬를 보여준다"는 신호를 barWidth 자체로 판단하면 대기중 줄무늬가 영원히 안
  // 뜬다. 애니메이션이 한 번 시작됐는지는 따로 표시한다.
  const [animationStarted, setAnimationStarted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setBarWidth(progress);
      setAnimationStarted(true);
    });
    return () => cancelAnimationFrame(id);
  }, [progress]);

  const displayedFilled = useCountUp(filledQty, 800, resetKey);
  const displayedProgress = useCountUp(progress, 800, resetKey);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] text-neutral-500">
          <span className="tabular text-2xl font-extrabold tracking-[-0.02em] text-neutral-900">
            {displayedFilled}
          </span>
          <span className="mx-1">/</span>
          {targetQty}개 채워짐
        </p>
        <span className={`tabular text-[17px] font-extrabold ${textClass(progress)}`}>
          {displayedProgress}%
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`${fillClass(progress)} rounded-full transition-[width] duration-700 ease-out`}
          style={{ width: `${barWidth}%` }}
        />
        {pendingWidth > 0 && (
          <div
            className="opacity-30 transition-[width] duration-700 ease-out"
            style={{
              width: `${animationStarted ? pendingWidth : 0}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 4px, transparent 4px 8px)",
              color: "var(--color-neutral-900)",
            }}
          />
        )}
      </div>

      {pendingQty > 0 && (
        <p className="text-xs text-neutral-400">
          기관 확인 대기중 {pendingQty}개 포함 시 {Math.min(100, progress + pendingWidth)}%
        </p>
      )}
    </div>
  );
}
