"use client";

import { useEffect } from "react";

/**
 * error.tsx도 못 잡는 최후의 안전망(루트 레이아웃 자체에서 난 예외 등).
 * 이 파일만은 자기 html/body를 직접 그려야 한다 — 루트 레이아웃이 깨졌을 때 대신 쓰이는 화면이라서다.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global error boundary]", error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <main
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>문제가 생겼어요</h1>
          <p style={{ color: "#6b7684" }}>화면을 불러오는 중 오류가 났어요. 다시 시도해주세요.</p>
          <button
            onClick={reset}
            style={{
              height: "3rem",
              padding: "0 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#628a26",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
