import { useEffect, useRef, useState } from "react";

/** 새로고침으로 일부러 0부터 다시 보여줄 때는, 값이 슬쩍 바뀔 때보다 느긋하게 올라가게 한다. */
const RESET_DURATION_MS = 1400;

/**
 * 0에서 목표값까지 슥 올라가는 숫자 애니메이션.
 * 모션을 줄이도록 설정한 사용자(prefers-reduced-motion)에게는 애니메이션 없이 바로 최종값을 보여준다.
 *
 * resetKey를 넘기면, 그 값이 바뀔 때만 0부터 다시(더 느리게) 세도록 강제한다 —
 * "새로고침을 눌렀다"처럼 일부러 리셋 연출을 보여주고 싶은 경우에 쓴다.
 * 안 넘기면 항상 마지막으로 보여준 값에서 이어서 움직인다(배경 자동 갱신 등).
 */
export function useCountUp(target: number, durationMs = 800, resetKey?: unknown) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);
  const fromRef = useRef(0);
  const prevResetKey = useRef(resetKey);

  useEffect(() => {
    const isReset = resetKey !== undefined && resetKey !== prevResetKey.current;
    prevResetKey.current = resetKey;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      fromRef.current = target;
      return;
    }

    if (isReset) fromRef.current = 0;

    const effectiveDuration = isReset ? RESET_DURATION_MS : durationMs;
    const from = fromRef.current;
    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / effectiveDuration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs, resetKey]);

  return value;
}
