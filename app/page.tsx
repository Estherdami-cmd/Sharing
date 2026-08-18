"use client";

import { useEffect, useRef, useState } from "react";
import AdminPanel from "./_components/AdminPanel";
import DonorFlow from "./_components/DonorFlow";
import NeedBoard from "./_components/NeedBoard";
import { shell } from "./ui";

type Mode = "board" | "donor" | "admin";

const TABS: { key: Mode; label: string }[] = [
  { key: "board", label: "진행률 게시판" },
  { key: "donor", label: "사진으로 기부하기" },
  { key: "admin", label: "기관 관리" },
];

export default function Home() {
  const [mode, setMode] = useState<Mode>("donor");
  const [refreshKey, setRefreshKey] = useState(0);
  const [stats, setStats] = useState<{ filled: number; target: number; count: number } | null>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // 히어로에 실제 수치를 얹는다. "지금 이만큼 기다린다"가 숫자로 보여야 설득력이 생긴다.
  useEffect(() => {
    fetch("/api/needs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.needs) return;
        setStats({
          filled: d.needs.reduce((s: number, n: { filledQty: number }) => s + n.filledQty, 0),
          target: d.needs.reduce((s: number, n: { targetQty: number }) => s + n.targetQty, 0),
          count: d.needs.length,
        });
      })
      .catch(() => {});
  }, []);

  // 세 탭이 항상 마운트된 채 display로만 전환되므로, 탭을 열 때마다 다시 불러온다.
  // 언마운트하면 기부자 플로우 중간에 입력하던 내용이 날아간다.
  function switchTo(next: Mode) {
    setMode(next);
    setRefreshKey((k) => k + 1);
  }

  /** 랜딩에서 앱으로 내려갈 때: 탭을 먼저 바꾸고 그 자리로 부드럽게 이동한다. */
  function goToApp(next: Mode) {
    switchTo(next);
    appRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-neutral-200/70 bg-neutral-50/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 md:px-6 lg:px-8">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex cursor-pointer items-center gap-2 border-none bg-transparent"
          >
            <span className="grid size-7 place-items-center rounded-lg bg-primary-500 text-sm font-extrabold text-neutral-900">
              나
            </span>
            <span className="text-[17px] font-extrabold tracking-[-0.03em]">나눔곳간</span>
          </button>

          <nav className="flex items-center gap-1">
            <button
              onClick={() => goToApp("donor")}
              className="cursor-pointer rounded-lg border-none bg-transparent px-3 py-2 text-[14px] font-bold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              기부하기
            </button>
            <button
              onClick={() => goToApp("board")}
              className="cursor-pointer rounded-lg border-none bg-transparent px-3 py-2 text-[14px] font-bold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              진행 현황
            </button>
          </nav>
        </div>
      </header>

      <section className="flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-5 py-16 text-center md:px-6">
        <span className="rounded-full bg-primary-100 px-3 py-1.5 text-xs font-bold text-primary-700">
          기관이 먼저 필요를 밝히는 나눔
        </span>

        <h1 className="mt-6 text-[34px] leading-[1.25] font-extrabold tracking-[-0.04em] text-neutral-900 md:text-[52px] xl:text-[60px]">
          사진 한 장이면
          <br />
          <span className="text-primary-700">필요한 곳</span>이 채워집니다
        </h1>

        <p className="mt-5 max-w-md text-[16px] leading-relaxed text-neutral-500 md:max-w-lg md:text-[18px]">
          AI가 품목과 유통기한을 읽고, 지금 가장 필요한 곳으로 연결해요.
          <br className="hidden md:block" /> 혼자 다 채우지 않아도 괜찮아요. 여럿이 나눠서 채웁니다.
        </p>

        {stats && (
          <p className="tabular mt-6 text-[15px] font-bold text-neutral-700">
            지금 <span className="text-primary-700">{stats.count}건</span>의 요청이{" "}
            <span className="text-primary-700">
              {stats.target - stats.filled}개
            </span>
            를 기다리고 있어요
          </p>
        )}

        <div className="mt-9 flex w-full max-w-xs flex-col gap-3 sm:max-w-md sm:flex-row sm:justify-center">
          <button
            onClick={() => goToApp("donor")}
            className="h-14 cursor-pointer rounded-full border-none bg-primary-700 px-8 text-[16px] font-bold text-white transition-all hover:bg-primary-800 active:scale-[0.98] sm:flex-1"
          >
            사진으로 기부하기
          </button>
          <button
            onClick={() => goToApp("board")}
            className="h-14 cursor-pointer rounded-full border-2 border-neutral-300 bg-white px-8 text-[16px] font-bold text-neutral-700 transition-all hover:border-neutral-400 active:scale-[0.98] sm:flex-1"
          >
            진행 현황 보기
          </button>
        </div>

        <button
          onClick={() => goToApp(mode)}
          aria-label="아래 내용 보기"
          className="mt-14 animate-bounce cursor-pointer border-none bg-transparent text-2xl text-neutral-300"
        >
          ↓
        </button>
      </section>

      <div ref={appRef} className="scroll-mt-16">
        <main className="flex flex-col items-center px-5 pt-10 pb-16 md:px-6 lg:px-8 xl:px-10">
          <div className={shell}>
            <p className="mx-auto max-w-md text-center text-xs leading-relaxed text-neutral-400">
              데모 화면입니다 · 입력한 데이터는 서버에 저장되지 않아 일정 시간 뒤 초기 상태로
              돌아갑니다
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
      </div>
    </>
  );
}
