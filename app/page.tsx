"use client";

import { useState } from "react";
import AdminPanel from "./_components/AdminPanel";
import DonorFlow from "./_components/DonorFlow";
import NeedBoard from "./_components/NeedBoard";
import { shell } from "./ui";

type Mode = "board" | "donor" | "admin";

const TABS: { key: Mode; label: string }[] = [
  { key: "board", label: "진행률 게시판" },
  { key: "donor", label: "기부자 모드" },
  { key: "admin", label: "기관 관리" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("board");
  const [refreshKey, setRefreshKey] = useState(0);

  // 세 탭이 항상 마운트된 채 display로만 전환되므로, 탭을 열 때마다 다시 불러온다.
  // 언마운트하면 기부자 플로우 중간에 입력하던 내용이 날아간다.
  function switchTo(next: Mode) {
    setMode(next);
    setRefreshKey((k) => k + 1);
  }

  return (
    <main className="flex min-h-screen flex-col items-center px-5 pt-8 pb-12 md:px-6 lg:px-8 xl:px-10">
      <div className={shell}>
        <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-neutral-400">
          데모 화면입니다 · AI 인식은 시뮬레이션이고, 입력한 데이터는 서버에 저장되지 않아 일정 시간
          뒤 초기 상태로 돌아갑니다
        </p>

        <div className="mx-auto flex gap-1 rounded-full bg-neutral-100 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTo(tab.key)}
              className={
                "cursor-pointer whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold transition-colors md:px-5 md:text-sm " +
                (mode === tab.key
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:text-neutral-900")
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className={mode === "board" ? "contents" : "hidden"}>
          <NeedBoard refreshKey={refreshKey} />
        </div>
        <div className={mode === "donor" ? "contents" : "hidden"}>
          <DonorFlow />
        </div>
        <div className={mode === "admin" ? "contents" : "hidden"}>
          <AdminPanel refreshKey={refreshKey} />
        </div>
      </div>
    </main>
  );
}
