import { useEffect } from "react";

/**
 * 다른 탭(기관 관리 등)에서 데이터를 바꾸고 돌아왔을 때, 보고 있던 화면이
 * 옛 숫자를 계속 들고 있지 않도록 탭이 다시 보이면 자동으로 다시 불러온다.
 */
export function useRefetchOnFocus(callback: () => void) {
  useEffect(() => {
    function handleVisible() {
      if (document.visibilityState === "visible") callback();
    }
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [callback]);
}
