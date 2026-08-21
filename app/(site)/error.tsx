"use client";

import { useEffect } from "react";
import { btnGhost, btnPrimary, pageDesc, pageTitle } from "@/app/ui";

/**
 * (site) 그룹 안에서 처리 안 된 예외가 나면 Next.js 기본의 딱딱한
 * "Application error" 화면 대신 이걸 보여준다. 원인을 못 찾았어도
 * 사용자가 최소한 새로고침/홈으로 빠져나갈 수 있게 하는 안전망이다.
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[site error boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 py-16 text-center">
      <h1 className={pageTitle}>문제가 생겼어요</h1>
      <p className={pageDesc}>
        화면을 불러오는 중 오류가 났어요. 데모 서버 데이터가 방금 초기화됐거나, 일시적인
        문제일 수 있어요.
      </p>
      <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
        <button onClick={reset} className={btnPrimary}>
          다시 시도
        </button>
        <a href="/" className={btnGhost}>
          홈으로 가기
        </a>
      </div>

      {/* 콘솔을 열 필요 없이 이 화면 그대로 캡처해서 보내면 원인을 바로 알 수 있게 한다. */}
      <div className="mt-4 w-full max-w-lg rounded-xl bg-neutral-100 p-4 text-left">
        <p className="text-xs font-bold text-neutral-500">개발용 상세 정보</p>
        <p className="mt-1 break-all font-mono text-xs text-neutral-700">
          {error.name}: {error.message || "(메시지 없음)"}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-neutral-400">digest: {error.digest}</p>
        )}
        <p className="mt-2 text-xs text-neutral-400">
          현재 페이지: {typeof window !== "undefined" ? window.location.href : ""}
        </p>
      </div>
    </main>
  );
}
