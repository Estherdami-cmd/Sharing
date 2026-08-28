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
  mineCounted = false,
  resetKey,
  compact = false,
}: {
  filledQty: number;
  targetQty: number;
  progress: number;
  pendingQty?: number;
  /** 이 막대에서 "이 사람 몫"이 몇 개인지. 넘기면 그 구간을 따로 칠하고 범례로 이름을 붙인다.
   * 안 넘기면 기존과 똑같이 동작한다 — 게시판·기관 화면은 넘기지 않는다.
   * (완료 화면처럼 "내가 얼마나 채우는가"가 주인공인 곳에서만 쓴다) */
  mineQty?: number;
  /** 내 몫이 이미 filledQty에 반영됐는지(수락됨). false면 아직 대기 구간에 있다.
   * 수락되고 나면 내 몫이 채움 색에 녹아 사라지는데, 그러면 "내가 채웠다"는 사실이
   * 화면에서 없어진다. 반영된 뒤에도 그 부분만 따로 칠해 남긴다. */
  mineCounted?: boolean;
  /** 값이 바뀔 때만 카운트업을 0부터 다시(느리게) 재생하고 싶을 때(예: 새로고침) 넘긴다. */
  resetKey?: unknown;
  /** 좁은 카드에서 쓴다. "30개 채워짐"의 "채워짐"이 두 줄로 쪼개지는 걸 막으려고
   *  단위 문구를 줄인다. 게시판 카드처럼 폭이 170px 남짓인 곳에서만 켠다. */
  compact?: boolean;
}) {
  const pendingWidth = Math.min(100 - progress, Math.round((pendingQty / targetQty) * 100));
  const mineShare = mineQty == null ? 0 : Math.round((mineQty / targetQty) * 100);
  // 수락됐으면 채움 구간의 끝에서, 아직이면 대기 구간의 앞에서 내 몫을 갈라낸다.
  // 어느 쪽이든 "이미 채워진 만큼" 바로 다음에 붙어야 내가 민 구간으로 읽힌다.
  const mineFilled = mineCounted ? Math.min(progress, mineShare) : 0;
  const minePending = mineCounted ? 0 : Math.min(pendingWidth, mineShare);
  const othersWidth = pendingWidth - minePending;
  const othersQty = mineQty == null ? pendingQty : Math.max(0, pendingQty - (mineCounted ? 0 : mineQty));

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

  /** 채움 막대가 0에서 자라는 동안에도 그 안에서 내 몫 비율이 유지되게 한다.
   * 내 몫을 고정 폭으로 두면 애니메이션 초반에 내 몫이 전체보다 길어져 막대가 튄다. */
  function mineFilledOf(currentWidth: number) {
    if (mineFilled <= 0 || progress <= 0) return 0;
    return (currentWidth * mineFilled) / progress;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className={`${compact ? "whitespace-nowrap text-xs" : "text-[13px]"} text-neutral-500`}>
          <span
            className={`tabular font-extrabold tracking-[-0.02em] text-neutral-900 ${
              compact ? "text-xl" : "text-2xl"
            }`}
          >
            {displayedFilled.toLocaleString()}
          </span>
          <span className="mx-1">/</span>
          {targetQty.toLocaleString()}개{compact ? "" : " 채워짐"}
        </p>
        <span className={`tabular text-[17px] font-extrabold ${textClass(progress)}`}>
          {displayedProgress}%
        </span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`${fillClass(progress)} ${
            // 내 몫이 바로 뒤에 붙을 때는 끝을 둥글리지 않는다 — 둥근 모서리가 이음매처럼 보인다.
            mineFilled > 0 ? "" : "rounded-full"
          } transition-[width] ease-out`}
          style={{
            width: `${Math.max(0, barWidth - mineFilledOf(barWidth))}%`,
            transitionDuration: `${barDuration}ms`,
          }}
        />
        {/* 수락돼 이미 채워진 내 몫. 채움 색보다 진하게 칠해 "여기까지가 내가 채운 곳"을 남긴다. */}
        {mineFilled > 0 && (
          <div
            className="bg-primary-700 rounded-r-full transition-[width] ease-out"
            style={{
              width: `${mineFilledOf(barWidth)}%`,
              transitionDuration: `${barDuration}ms`,
            }}
          />
        )}
        {/* 아직 대기중인 내 몫. 고정된 연두색 대신 지금 채움 색(fillClass)을 그대로 옅게
            써서 한 색 계열로 이어지게 한다 — 진행률이 낮아 막대가 빨간색(danger)일 때도
            엉뚱한 초록이 붙지 않는다. 진한 색 = 확정, 옅은 색 = 아직. */}
        {minePending > 0 && (
          <div
            className={`${fillClass(progress)}/45 transition-[width] duration-700 ease-out`}
            style={{ width: `${animationStarted ? minePending : 0}%` }}
          />
        )}
        {othersWidth > 0 &&
          (mineQty == null ? (
            // 게시판·기관·매칭 화면(내 몫을 구분하지 않는 곳)의 대기중 구간.
            // 예전엔 빗금이었는데, 진행률 색과 안 이어져서 뭉개져 보인다는 피드백으로
            // 위 minePending과 같은 방식(채움 색을 옅게)으로 통일했다.
            <div
              className={`${fillClass(progress)}/45 transition-[width] duration-700 ease-out`}
              style={{ width: `${animationStarted ? othersWidth : 0}%` }}
            />
          ) : (
            <div
              className="bg-neutral-200 transition-[width] duration-700 ease-out"
              style={{ width: `${animationStarted ? othersWidth : 0}%` }}
            />
          ))}
      </div>

      {/* 색만 갈라놓으면 그게 내 것인 줄 알 방법이 없다. 이름을 붙여준다. */}
      {mineQty != null && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-[3px] ${
                mineCounted ? "bg-primary-700" : `${fillClass(progress)}/45`
              }`}
            />
            내 신청 <strong className="text-neutral-900">{mineQty.toLocaleString()}개</strong>
            {mineCounted ? " (반영됨)" : ""}
          </span>
          {othersQty > 0 && (
            // "다른 대기"라고만 하면 누가 무엇을 기다리는 건지 알 수 없다. 주어를 밝힌다.
            <span className="flex items-center gap-1.5 text-neutral-400">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-neutral-200" />
              다른 기부자 {othersQty.toLocaleString()}개
            </span>
          )}
        </div>
      )}

      {mineQty == null
        ? pendingQty > 0 && (
            <p className="text-xs text-neutral-400">
              기관 확인 대기중 {pendingQty.toLocaleString()}개 포함 시{" "}
              {Math.min(100, progress + pendingWidth)}%
            </p>
          )
        : // 퍼센트 하나만 던지는 것보다 "얼마에서 얼마로"가 훨씬 빨리 읽힌다.
          // 수락된 뒤에는 내가 실제로 밀어올린 구간을 과거형으로 말해준다.
          (mineCounted ? mineFilled > 0 : minePending > 0 || othersWidth > 0) && (
            <p className="text-xs text-neutral-500">
              {mineCounted ? (
                <>
                  회원님 덕분에{" "}
                  <span className="tabular text-neutral-400">{progress - mineFilled}%</span>
                  <span className="mx-1 text-neutral-300">→</span>
                  <strong className="tabular text-primary-700">{progress}%</strong>
                  {progress >= 100 && " · 목표를 다 채웠어요"}
                </>
              ) : (
                <>
                  내 신청이 수락되면{" "}
                  <span className="tabular text-neutral-400">{progress}%</span>
                  <span className="mx-1 text-neutral-300">→</span>
                  <strong className="tabular text-primary-700">
                    {Math.min(100, progress + minePending)}%
                  </strong>
                  {othersWidth > 0 &&
                    ` · 다른 기부자 것까지 ${Math.min(100, progress + pendingWidth)}%`}
                </>
              )}
            </p>
          )}
    </div>
  );
}
