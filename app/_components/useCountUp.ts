import { useEffect, useRef, useState } from "react";

/**
 * 0에서 목표값까지 슥 올라가는 숫자 애니메이션.
 * 모션을 줄이도록 설정한 사용자(prefers-reduced-motion)에게는 애니메이션 없이 바로 최종값을 보여준다.
 */
export function useCountUp(target: number, durationMs = 800) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }

    const start = performance.now();

    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      setValue(Math.round(target * eased));
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    }
    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [target, durationMs]);

  return value;
}
