"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [stats, setStats] = useState<{ filled: number; target: number; count: number } | null>(null);

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

  return (
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

      {/* 숫자는 하나만 보여준다. 여러 개를 늘어놓으면 무엇을 세는 값인지 헷갈린다.
          말투는 카드의 "35개만 더 모으면 목표를 채워요"와 일부러 맞췄다.
          높이를 미리 잡아두는 건 수치가 늦게 도착해도 아래 버튼이 밀리지 않게 하려는 것이다. */}
      <p className="mt-6 flex min-h-6 items-center text-[15px] font-bold text-neutral-700 md:text-[16px]">
        {stats &&
          (stats.target - stats.filled > 0 ? (
            <>
              <span className="tabular text-primary-700">{stats.target - stats.filled}개</span>
              만 더 모으면 모든 목표가 채워져요
            </>
          ) : (
            "지금 올라온 목표가 모두 채워졌어요"
          ))}
      </p>

      <div className="mt-9 flex w-full max-w-xs flex-col gap-3 sm:max-w-md sm:flex-row sm:justify-center">
        <Link
          href="/donate"
          className="flex h-14 cursor-pointer items-center justify-center rounded-full bg-primary-700 px-8 text-[16px] font-bold text-white transition-all hover:bg-primary-800 active:scale-[0.98] sm:flex-1"
        >
          사진으로 기부하기
        </Link>
        <Link
          href="/board"
          className="flex h-14 cursor-pointer items-center justify-center rounded-full border-2 border-neutral-300 bg-white px-8 text-[16px] font-bold text-neutral-700 transition-all hover:border-neutral-400 active:scale-[0.98] sm:flex-1"
        >
          진행 현황 보기
        </Link>
      </div>
    </section>
  );
}
