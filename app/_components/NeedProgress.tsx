"use client";

/**
 * 이 서비스에서 가장 많이 반복되는 요소라 별도 컴포넌트로 뺐다.
 * 낮은 진행률에 빨강을 쓰는 건 의도적이다 — 0%가 회색이면 "아무도 관심 없는 요청"으로
 * 보이지만, 빨강이면 "여기가 제일 급하다"로 읽힌다.
 */

import { useEffect, useRef, useState } from "react";
import { useCountUp } from "./useCountUp";

/** 새로고침으로 일부러 0부터 다시 채울 때는, 값이 슬쩍 바뀔 때보다 느긋하게 채운다. */
const RESET_BAR_DURATION_MS = 1400;
const DEFAULT_BAR_DURATION_MS = 700;

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
  mineQty,
  resetKey,
}: {
  filledQty: number;
  targetQty: number;
  progress: number;
  pendingQty?: number;
  /** 대기중 물량 가운데 "이 사람 몫". 넘기면 대기 구간을 내 몫과 남의 몫으로 나눠 칠하고
   * 캡션도 내 기여 중심으로 바뀐다. 안 넘기면 기존과 똑같이 대기 전체를 한 덩어리로 본다.
   * (완료 화면처럼 "내가 얼마나 채우는가"가 주인공인 곳에서만 쓴다) */
  mineQty?: number;
  /** 값이 바뀔 때만 카운트업을 0부터 다시(느리게) 재생하고 싶을 때(예: 새로고침) 넘긴다. */
  resetKey?: unknown;
}) {
  const pendingWidth = Math.min(100 - progress, Math.round((pendingQty / targetQty) * 100));
  // 내 몫을 대기 구간의 앞쪽에 붙인다 — 채워진 막대에 바로 이어져야 "내가 여기까지 민다"로 읽힌다.
  const mineWidth =
    mineQty == null ? 0 : Math.min(pendingWidth, Math.round((mineQty / targetQty) * 100));
  const othersWidth = mineQty == null ? pendingWidth : pendingWidth - mineWidth;

  // 바가 뜨자마자 최종 길이로 딱 나타나지 않고, 0에서 실제 값까지 채워지며 나타나게 한다.
  const [barWidth, setBarWidth] = useState(0);
  const [barDuration, setBarDuration] = useState(DEFAULT_BAR_DURATION_MS);
  // progress가 정확히 0이면 barWidth도 계속 0이라, "barWidth가 채워진 뒤에 대기중
  // 줄무늬를 보여준다"는 신호를 barWidth 자체로 판단하면 대기중 줄무늬가 영원히 안
  // 뜬다. 애니메이션이 한 번 시작됐는지는 따로 표시한다.
  const [animationStarted, setAnimationStarted] = useState(false);
  const prevResetKeyRef = useRef(resetKey);

  useEffect(() => {
    // resetKey가 바뀌었을 때만(예: 새로고침 버튼) 바를 0으로 되돌려서 숫자
    // 카운트업과 같은 속도로 다시 채운다 — 안 그러면 옆의 %는 0부터 올라가는데
    // 바는 이미 그 자리에 있는 것처럼 보여서 두 표시가 서로 다른 값을 보여준다.
    const isReset = resetKey !== undefined && resetKey !== prevResetKeyRef.current;
    prevResetKeyRef.current = resetKey;

    if (isReset) {
      setBarWidth(0);
      setBarDuration(RESET_BAR_DURATION_MS);
    } else {
      setBarDuration(DEFAULT_BAR_DURATION_MS);
    }

    const id = requestAnimationFrame(() => {
      setBarWidth(progress);
      setAnimationStarted(true);
    });
    return () => cancelAnimationFrame(id);
  }, [progress, resetKey]);

  const displayedFilled = useCountUp(filledQty, 800, resetKey);
  const displayedProgress = useCountUp(progress, 800, resetKey);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] text-neutral-500">
          <span className="tabular text-2xl font-extrabold tracking-[-0.02em] text-neutral-900">
            {displayedFilled.toLocaleString()}
          </span>
          <span className="mx-1">/</span>
          {targetQty.toLocaleString()}개 채워짐
        </p>
        <span className={`tabular text-[17px] font-extrabold ${textClass(progress)}`}>
          {displayedProgress}%
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`${fillClass(progress)} rounded-full transition-[width] ease-out`}
          style={{ width: `${barWidth}%`, transitionDuration: `${barDuration}ms` }}
        />
        {/* 내 몫은 같은 빗금이되 브랜드 색으로 칠한다 — 회색 빗금과 나란히 놓으면
            "어디까지가 내가 민 부분인지"가 색 하나로 읽힌다. */}
        {mineWidth > 0 && (
          <div
            className="opacity-70 transition-[width] duration-700 ease-out"
            style={{
              width: `${animationStarted ? mineWidth : 0}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 4px, transparent 4px 8px)",
              color: "var(--color-primary-600)",
            }}
          />
        )}
        {othersWidth > 0 && (
          <div
            className="opacity-30 transition-[width] duration-700 ease-out"
            style={{
              width: `${animationStarted ? othersWidth : 0}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 4px, transparent 4px 8px)",
              color: "var(--color-neutral-900)",
            }}
          />
        )}
      </div>

      {pendingQty > 0 &&
        (mineQty == null ? (
          <p className="text-xs text-neutral-400">
            기관 확인 대기중 {pendingQty.toLocaleString()}개 포함 시{" "}
            {Math.min(100, progress + pendingWidth)}%
          </p>
        ) : (
          <p className="text-xs text-neutral-500">
            내 신청 {mineQty.toLocaleString()}개가 더해지면{" "}
            <strong className="text-primary-700">{Math.min(100, progress + mineWidth)}%</strong>
            {othersWidth > 0 &&
              ` · 다른 대기까지 ${Math.min(100, progress + pendingWidth)}%`}
          </p>
        ))}
    </div>
  );
}
