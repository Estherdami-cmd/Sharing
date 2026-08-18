"use client";

import { useState } from "react";
import AdminPanel from "./_components/AdminPanel";
import DonorFlow from "./_components/DonorFlow";
import NeedBoard from "./_components/NeedBoard";

type Mode = "board" | "donor" | "admin";

export default function Home() {
  const [mode, setMode] = useState<Mode>("board");
  const [refreshKey, setRefreshKey] = useState(0);

  // 세 탭이 항상 마운트된 채 display로만 전환되므로, 탭을 열 때마다 다시 불러온다.
  // 다른 탭에서 기부하거나 수락해 진행률이 이미 바뀌었을 수 있다.
  function switchTo(next: Mode) {
    setMode(next);
    setRefreshKey((k) => k + 1);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 20px 48px",
        gap: "24px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "#f3f4f6",
          borderRadius: "999px",
          padding: "4px",
        }}
      >
        <button onClick={() => switchTo("board")} style={tabStyle(mode === "board")}>
          진행률 게시판
        </button>
        <button onClick={() => switchTo("donor")} style={tabStyle(mode === "donor")}>
          기부자 모드
        </button>
        <button onClick={() => switchTo("admin")} style={tabStyle(mode === "admin")}>
          기관 관리
        </button>
      </div>

      <div style={{ display: mode === "board" ? "contents" : "none" }}>
        <NeedBoard refreshKey={refreshKey} />
      </div>
      <div style={{ display: mode === "donor" ? "contents" : "none" }}>
        <DonorFlow />
      </div>
      <div style={{ display: mode === "admin" ? "contents" : "none" }}>
        <AdminPanel refreshKey={refreshKey} />
      </div>
    </main>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    border: "none",
    borderRadius: "999px",
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    background: active ? "#16a34a" : "transparent",
    color: active ? "#ffffff" : "#6b7280",
  };
}
