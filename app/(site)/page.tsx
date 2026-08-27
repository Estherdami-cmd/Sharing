"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toneBadge } from "@/app/ui";
import styles from "./Hero.module.css";

type PreviewNeed = {
  id: string;
  itemName: string;
  category: string;
  urgent: boolean;
  progress: number;
  remainingQty: number;
  foodBank: { name: string };
};

/** 진행률에 따라 손그림 미리보기 카드의 바 색을 정한다. NeedProgress와 같은 기준. */
function barColor(progress: number) {
  if (progress >= 100) return "bg-success-fg";
  if (progress >= 60) return "bg-primary-600";
  if (progress >= 30) return "bg-primary-500";
  return "bg-danger-fg";
}

/** 카테고리별 간단한 선 아이콘. lib/rules.ts의 CATEGORIES와 맞춘다. */
function categoryIcon(category: string) {
  switch (category) {
    case "통조림":
      return (
        <>
          <rect x="6" y="6" width="12" height="14" rx="1" />
          <ellipse cx="12" cy="6" rx="6" ry="2" />
        </>
      );
    case "세제":
      return (
        <>
          <path d="M9 3h6v2.5l1.5 2V19a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V7.5L9 5.5V3Z" />
          <path d="M9 10h6" />
        </>
      );
    case "화장지":
      return (
        <>
          <ellipse cx="12" cy="7" rx="5" ry="3" />
          <path d="M7 7v9M17 7v9" />
          <path d="M7 16a5 2 0 0 0 10 0" />
        </>
      );
    case "위생용품":
      return <path d="M12 3c3 4 6 7.5 6 11a6 6 0 1 1-12 0c0-3.5 3-7 6-11Z" />;
    case "쌀/곡물":
      return <path d="M8 4h8l2 5-1 3 1 4-2 5H8l-2-5 1-4-1-3 2-5Z" />;
    default:
      return (
        <>
          <rect x="4" y="8" width="16" height="12" rx="1" />
          <path d="M4 8l8-4 8 4" />
          <path d="M12 4v16" />
        </>
      );
  }
}

export default function Home() {
  const [needs, setNeeds] = useState<PreviewNeed[]>([]);
  const [floatItems, setFloatItems] = useState<PreviewNeed[]>([]);

  // 아래 섹션의 미리보기 카드 3장, 히어로에 둥둥 떠다니는 칩 최대 8개 모두 같은
  // 실제 데이터에서 가져온다 — /api/needs가 이미 긴급도·진행률 순으로 정렬해서 내려준다.
  useEffect(() => {
    fetch("/api/needs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.needs) {
          setNeeds(d.needs.slice(0, 3));
          setFloatItems(d.needs.slice(0, 8));
        }
      })
      .catch(() => {});
  }, []);

  function goNext() {
    document.getElementById("next-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <section className="relative flex min-h-[calc(100svh-4rem)] w-full flex-col items-center justify-center overflow-hidden bg-[#849268] px-[6vw] py-[9vh]">
        <div className={styles.bgDrift} />

        <svg
          className="pointer-events-none absolute inset-0 z-0 h-full w-full opacity-90 mix-blend-overlay"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="grain" x="0%" y="0%" width="100%" height="100%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves={2}
                seed={6}
                stitchTiles="stitch"
                result="noise"
              />
              <feColorMatrix
                in="noise"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.4 0.4 0.4 0 0"
                result="noiseAlpha"
              />
              <feComponentTransfer in="noiseAlpha">
                <feFuncA type="linear" slope={0.19} intercept={0} />
              </feComponentTransfer>
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="#0b1400" filter="url(#grain)" />
        </svg>

        {/* 워드마크가 정중앙에 고정되고, 실제 나눔 요청 칩들이 그 둘레에 고른
            간격(같은 각도 간격의 원)으로 떠 있다가 흐려지며 사라진다. */}
        <div className="relative z-10 flex h-[64vh] max-h-[560px] min-h-[380px] w-full max-w-[560px] items-center justify-center">
          {floatItems.map((need, i) => {
            const angle = (i * (360 / floatItems.length) - 90) * (Math.PI / 180);
            const rx = 30;
            const ry = 40;
            return (
            <div
              key={need.id}
              className={`absolute ${styles.floatFade}`}
              style={{
                left: `${50 + rx * Math.cos(angle)}%`,
                top: `${50 + ry * Math.sin(angle)}%`,
                transform: "translate(-50%, -50%)",
                animationDelay: `${i * 0.35}s`,
                animationDuration: `${9 + (i % 4) * 1.6}s`,
              }}
            >
              <div
                className={styles.floatBob}
                style={{ animationDelay: `${i * 0.4}s`, animationDuration: `${3.4 + (i % 3) * 0.6}s` }}
              >
                <div className="flex max-w-[172px] items-center gap-2 rounded-2xl border border-white/40 bg-white/25 px-3.5 py-2 shadow-lg backdrop-blur-md backdrop-saturate-150">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/40">
                    <svg
                      width={15}
                      height={15}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#5D7A2F"
                      strokeWidth={1.7}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {categoryIcon(need.category)}
                    </svg>
                  </span>
                  <div className="min-w-0 text-left">
                    <div className="truncate text-[10px] font-normal text-primary-800">{need.foodBank.name}</div>
                    <div className="truncate text-[12.5px] font-normal text-neutral-900">{need.itemName}</div>
                  </div>
                </div>
              </div>
            </div>
            );
          })}

          {/* 여러시 워드마크 — 화면 정중앙에 고정, 입장 후 살짝 축소되고
              잠시 머물다 기부 버튼으로 자리를 넘겨주며 사라진다. */}
          <div
            className={`${styles.typeSlot} absolute w-[min(92vw,560px)]`}
            style={{ aspectRatio: "287 / 105" }}
          >
          <svg viewBox="418 1112 287 105" className="absolute inset-0 h-full w-full">
            <defs>
              <filter id="textureType" x="-15%" y="-15%" width="130%" height="130%">
                <feTurbulence type="fractalNoise" baseFrequency={0.75} numOctaves={2} seed={14} result="tnoise" />
                <feColorMatrix
                  in="tnoise"
                  type="matrix"
                  values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.5 0.5 0.5 0 0"
                  result="tnoiseAlpha"
                />
                <feComponentTransfer in="tnoiseAlpha" result="tnoiseAlphaAdj">
                  <feFuncA type="linear" slope={0.26} intercept={0.03} />
                </feComponentTransfer>
                <feComposite in="tnoiseAlphaAdj" in2="SourceGraphic" operator="in" result="tnoiseMasked" />
                <feBlend in="SourceGraphic" in2="tnoiseMasked" mode="multiply" />
              </filter>
            </defs>

            <g className={styles.letterEnter} fill="#F9FAFB" filter="url(#textureType)" fillRule="evenodd">
              <path d="M543.28,1135.52l-1.24.99-2.01-.17-.77.33h-1.7l-.62-.33h-.77l-.77.5-1.54,1.49.62,2.16v1.16l.15.33.46.33.93.17,1.08.99h1.24l2.16.83h1.7l1.08-.33h2.16l.15.17,3.55.17.62-.33h1.08l1.39,1.33,1.08.66-.15,1.49-.77,1.33-1.08.66-.77.83-1.85,1.33-.77.83-1.85,1.16-2.62,2.98-1.54.99v.33l-.46.83v.83l-.46.99-.93.99-.15.66-.46.83v.83l.31.83v1.49l-.31,1.16v1.49l.77,2.32v1.82l.46,1.16.46.5h.31l.62.66.46,1.49,1.08.99v.33l.46.83,1.54,1.33h.93l.46.33h.31l1.24,1.49,1.08.17.46.33h.31l.31.33,3.09,1.16h.77l.62-.33h1.24l.77.33.77.83h1.08l1.54-.5,5.87.17.15-.17,1.08-.17.46-.33,3.09.17,1.54-.83h1.24l.77.33h.93l.77-.33h1.39l1.24-.83.46-.17.77.17.46-.33h.31l.62-.66v-.99l.15-.33.93-.83v-.33l-.46-.99-.15-1.16-.46-.5-.62-.17-1.39-1.49h-.93l-.93.5h-1.24l-.77-.33-1.85-.17-.93.83h-.46l-.15.17-3.55-.33-1.54.66h-4.32l-.15-.17h-.62l-.62-.5h-.93l-.46.33h-.77l-.93-.33-.77-.83h-1.7l-1.7-.66-.62-.66-.62-.33-2.01-.5-1.24-.99v-.66l-1.08-.33-.77-1.66-.46-1.49v-1.16l1.08-1.16-.15-1.99.31-.66.62-.66h.31l.77-.99.15-.66.62-.83.46-.17.46-.5,1.39-.99.77-.33,2.16-1.66,1.08-.33,1.39-2.16,1.7-1.33.31-.5v-.99l.31-.83,1.08-1.16.15-4.64-1.24-.83-.77-1.82-.62-.5-1.08-1.33-.93-.17-.93-.66h-.31l-.31-.33-.93-.33-.77-.66-2.93-.33-.15-.17h-1.39l-.15-.17h-4.79l-1.85-.66h-.15Z" />
              <path d="M473.34,1134.19l-.31.33-.77.33h-1.54l-.15-.17h-4.32l-.15.17-1.54.17-1.39.83-2.78.66-.77.83-.62.33-1.85.33-.77.83-1.24.83h-.31l-1.54,2.32-2.16,2.16v.5l-.46.99-1.7,1.66-.15.5v1.49l.15.17-1.08,2.16v.5l-.62.5-.31.5v.99l-.46,1.49v.83l-.15.17-.31,2.65-.15.17v.83l.46.83v.99l-.62.99v.5l.46.99v2.16l.46.5.46,1.16v1.66l1.08,1.49.46.99v.33l.31.33v.5l.31.5.31,1.49,1.24,1.33.93,1.66.15,1.33.46.5,1.39.5.93.99.77,1.16,1.08.66.77.83.46,1.49,2.62.66,1.85,1.66,1.24.17.62.33,2.16,1.99h3.24l1.08.5h1.24l.15-.17,1.24.66h4.48l.62-.33h1.39l1.7-1.66h.31l.62-.5v-.66l-.46-.66-.31-1.49-.31-.33-.77-.17-1.24-1.16h-4.17l-.77-.33h-2.16l-.15-.17-1.08-.17-1.7-1.16-1.85-.33-1.39-.66-.77-.66-.62-.17-2.01-1.99-.93-1.82-2.62-2.32-.15-.5-1.24-1.82v-.33l-.77-1.33-.46-1.66-.93-1.99v-.5l-.31-.83-.15-1.49-.46-1.66v-3.48l.15-.17v-1.16l.15-.17v-.83l.15-.17v-.83l.15-.17.31-1.99.46-.99.62-.66.31-.66.93-2.98,2.47-2.82.93-.66,1.7-1.66h.62l1.85-.83.93-.83h.77l.46-.33,1.39-.17.15-.17,3.24.17,1.24.5,1.08.17.46.33,1.85.17.62.33h.46l.77.5.62.17.31.33.77.33.15.33.93.66,2.47,1.33,2.16,1.99v.33l1.24,1.49.46,1.16,1.24,1.99.15.5-.15.17.15,1.49.31.99.31.33v2.65l-.77,1.33v1.16l-.62,1.16-1.7,1.66-.31.99-.62.66-.93.66-1.54.17-2.01.99-1.54.17-.93-.5-1.7-.17-.46-.5v-.66l-.31-.33-.93-.33-.62-.66-.46-.83v-.5l-.31-.66-.93-.99v-1.16l.15-.17h1.24l.31.33.77.17.77.5h1.08l.31-.17.93.66h.62l.62-.66.31-.66,1.85-1.66v-.5l-.62-.83-.15-.83-1.39-2.98-.46-.5-.46-.99-1.39-1.33-.93-1.49-2.47-.5-.46-.33h-.46l-1.24-.83h-.93l-1.24.66-1.7.17-1.85.99-.31.5v.33l-.31.33v.33l-.77.83-.15.66-1.7,1.66v5.14l.46,1.16-.15,2.32.62,1.16.46.33.77,1.49.15,1.66.46.5.62.17,1.24,1.33v.5l.31.66.46.33.93.17,1.08.66,1.54,1.82.31.17h2.16l.46.33h.62l1.54.99h1.39l1.39-.5h1.54l.62.33h1.08l1.24-1.16h.46l.15-.17h.46l.15.17,1.54-.17,1.39-1.66.62-.5.77-.33h.93l.62-.5v-.33l.46-.83,3.71-4.14.15-.99.62-1.49,1.08-1.33v-1.16l-.15-.17v-3.81l.46-1.16.15-1.16-1.08-1.49-.31-1.66-.15-.17v-.66l-1.54-1.82v-1.99l-1.85-1.49-1.24-1.49v-.33l-.77-1.33-1.39-.33-2.16-1.33-1.85-2.32-1.39-.17-2.16-1.49h-.93l-.46-.33-1.24-.17-2.16-.99-1.85-.17-1.08-.5-.62-.5h-.46Z" />
              <path d="M509.47,1134.03l-2.32,1.49h-.77l-1.08.66v3.65l1.08.99.46.99.15,1.33.31.5.15.83.46.66v.33l.77,1.16v.99l.46.83v.33l-.15.17h-.93l-.15-.17h-2.93l-.15.17h-.62l-.62.5-1.08.5-.62.66-.15.99-.31.5.15,1.99.62.66.15.5.77.99h.62l.93.5h1.08l1.39-.5h2.47l.15.17,1.24.17,1.24,1.99v2.32l1.08,1.49-.77.33h-1.54l-1.24-.5h-2.01l-1.24.5h-2.62l-1.54.83-.46,1.82-.77,1.49v.5l.62.66h.46l.77.83.15.5,1.54.5h1.39l1.08-.5h1.24l.62.33h2.62l.15-.17h.93l.15-.17h2.93l.31.33v.5l.31.5v.33l.77,1.49v1.16l.77.66.31.83.31.33v.5l.15.17-.15,1.33.93,1.33.46.99.31,1.33.62,1.16v1.66l2.32,1.49,1.08,1.33h.31l.62.5h.93l.31-.33,1.39-.66,1.54.17,1.7-2.49v-.5l-.62-.66-1.08-1.99v-.66l-.93-2.16v-1.16l-.15-.33-1.08-1.16-.62-1.33.15-1.99-1.39-1.33-.31-.66v-.66l-.31-.66v-1.33l-.93-1.33-.46-1.33.15-1.49-.15-.33-.62-.5-.15-1.33-.77-1.66v-1.99l-.46-.66-.77-.66-.46-1.16v-2.16l-.93-.83-.46-1.33-.15-1.82-1.24-1.49-.15-.83-.31-.5v-1.99l-1.24-1.16-.46-.99v-.5l-.46-.83v-1.49l-.62-.5-1.24-1.49.15-1.16-.46-.33-.77-.17-.46-.33-.62-.83-.31-.17h-.93Z" />
              <path d="M637.46,1130.88l-1.08.83-1.08.17-.62,1.49v1.49l-.31.5-.15.83-.62.83-.62,1.99-.77.99v.33l-1.08,2.32v.33l-.31.33v.33l-.77,1.33-.15.66-1.24,2.16v.5l-.62,1.49-1.08,1.33-.77.5-.31,1.49-.77,1.33-.31,1.66-.77,1.49-1.24,1.16-1.24,2.82v.33l-.31.33v.5l-.62.99-.62.5-.77.99v.33l-.77,1.33-.15.66-.46.5v.33l-.93,1.66-1.39,1.33-.46.66v.66l.31.66v1.99l1.54.5,2.47,1.33h.77l1.24-1.49,1.54-.99.93-1.33,1.39-2.98,1.54-1.33.31-1.16v-.83l.46-.99,1.39-.99.46-2.49.62-.99.77-.83,1.08,1.33v.33l.62,1.33h.15l1.7,1.99.31.66v.83l.15.33,1.08.83h.46l1.39,1.49.62,1.16,1.7,1.49.93,1.16,1.08.99.93,1.66,1.08.33h.77l1.39.5.46.66.46.33h.46l.77-.83,1.08-.5h.46l.93-.5.46-.5v-.5l-.62-.83-.15-1.33-.62-1.66-1.08-.5-.77-.99-.62-1.33-.77-.5h-.46l-1.7-1.82-.15-.66-.62-.99-.62-.17-.31-.33h-.31l-1.24-1.33-.15-.5-.77-.99-1.08-2.65-.62-.5-.15-.66-1.08-1.82v-1.33l-.77-.66h-.31l-.62-.66-.31-.83.15-1.33.46-.99.46-.5.31-.66v-.5l.62-1.33.62-.83.77-.5.62-.66v-1.82l.15-.17v-.5l.77-1.49.46-1.82.93-.83.62-2.65.31-.33v-.5l-.31-.17-.62-.99v-.83l-.31-.66-1.08-.33-.77-.66h-.77l-.15-.17-1.08-.17h-.15Z" />
              <path d="M588.83,1127.89l-.77.33h-1.08l-1.85,1.33-.31.99.15,2.98-.46.99v.66l.46.99v2.32l-.46,1.16v.5l.31.5.31,1.16v3.15l.31.83.15,1.49.31.5-.15.17h-2.47l-.15.17-3.4-.17-.93.5h-1.08l-.93-.5h-1.08l-.62.5-.93.33h-1.54l-.93-.33h-.93l-2.62,2.65v.33l.93,1.49.31,1.16,2.62,1.49,1.24-.17.15-.17h4.01l.15.17h3.4l.77-.33h1.54l.15.17,3.71-.17.15.17.15,1.16.77,1.82v.5l.31.5-.15.17v.66l.46.99.62.5.31.5.46,1.66-.15.33v1.33l.62.83.31.99v1.16l.15.17v.83l.15.17v.66l.31.99.15,2.49.15.17-.15,3.48.31.33.31.99v1.33l-.31.83-.31.33v.5l.46.66.31.99.15,2.82-.31.99.46.66.46.33.77.17.31.33h.31l.46.66.93.66h.77l2.16-.99h.62l.15-.17h1.85l.77-.5.46-1.16.46-.66,1.7-1.66.15-1.66.62-2.16v-.83l-.77-1.49.15-2.98-.15-.17-.15-1.33-.46-.66-.31-.99v-.66l-.15-.17.15-.17v-1.33l-.15-.33-.62-.5-.77-1.66-.15-1.66-.93-1.16-.15-.66-.62-.83-.46-1.49-.77-1.16v-.5l-.15-.17v-1.66l-.77-.5-.77-.83-.15-.83-.77-1.16.15-1.66-.46-.99v-.5l-.31-.66v-.66l-1.39-1.82v-.5l-.15-.17v-2.16l-.62-2.32v-2.32l-.31-.99v-1.33l-.15-.17v-.83l-.15-.17-.31-2.16-.15-.17v-4.48l-.31-1.16-.62-.66-.93-.17-1.08-1.16h-1.24Z" />
              <path d="M668.5,1121.93l-.93.99-2.01.99-.31.99v1.33l.46,1.49v4.97l-.15.17v.5l.15.17-.77,1.82v.5l.62.99v1.49l-.15.17v.66l-.31.99v1.82l-.46,1.66v.66l.46.83v.5l.15.17v2.49l-.15.17v.83l.62,1.33-.15.17v.99l-.46.99.15,1.49.15.17v6.3l.31.83v2.49l-.31.83.15.5v1.33l-.46,1.16-.15,1.66.31.5.46.33.31.66v3.48l.15.17-.15,5.47.62,1.66-.15,3.32.62.83.31.99.31,2.82.77,1.99v.66l-.15.17.15,2.16-.15.17v.83l-.31.83v.83l.77.99.15.5v1.33l-.15.17v1.49l-.46.99v.66l1.39,1.99.77.17,1.7.99,2.78.17.77-.99.15-.5,1.39-1.33v-.66l-.31-.99v-6.47l.15-.17v-.99l-.62-.83-.15-1.16.31-.33v-.66l-.46-1.16-.31-.33v-.66l-.46-1.16v-3.15l-.46-1.16v-1.33l.46-.83v-.83l-.46-.83-.31-1.66-.15-.17v-.83l-.15-.17v-2.65l-.31-.83v-3.48l.15-.17.15-2.16-.62-.83-.15-.5v-.83l.62-1.33v-.99l-.46-.83v-4.14l.31-.5v-1.16l-.62-1.33v-1.16l.31-.66v-1.82l-.15-.17v-1.33l-.15-.17v-1.66l.31-.83v-2.82l.15-.17v-1.16l.31-.99v-.99l-.62-1.16v-.99l.62-.99v-.99l-.77-1.49v-1.49l.31-.66.15-5.31.31-.99.62-.83v-.33l-.93-1.16-.31-.99v-.66l-1.24-.33-1.54-1.16-1.24-.17-.15-.17h-.93Z" />
            </g>
          </svg>
          </div>

          {/* 워드마크가 자리를 비운 정중앙에 기부 버튼이 나타난다 — 누르면 바로 기부하기로. */}
          <Link
            href="/donate"
            className={`${styles.ctaReveal} absolute left-1/2 top-1/2 whitespace-nowrap rounded-full bg-[#F9FAFB] px-11 py-5 text-[17px] font-extrabold tracking-[-0.01em] text-primary-800 shadow-lg transition-transform active:scale-[0.98]`}
          >
            사진으로 기부하기
          </Link>
        </div>

        <div className={`${styles.taglineFade} relative z-10 flex flex-col items-center px-[4vw] text-center`}>
          <span
            className="block text-[clamp(15px,3.4vw,19px)] font-semibold tracking-[-0.01em] opacity-80"
            style={{ color: "#F9FAFB" }}
          >
            안 쓰는 물건도,
          </span>
          <span
            className="mt-1.5 block text-[clamp(22px,5.6vw,32px)] font-extrabold leading-[1.3] tracking-[-0.02em]"
            style={{ color: "#F9FAFB" }}
          >
            사진 한 장이면 기부가 됩니다
          </span>
        </div>

        <button
          onClick={goNext}
          aria-label="아래로 스크롤"
          className={`${styles.scrollBtn} absolute bottom-[4vh] left-1/2 z-10 -translate-x-1/2`}
        >
          <svg width="30" height="30" viewBox="0 0 40 40">
            <path
              d="M8,15 C14,24 18,29 20,32 C22,29 26,24 32,15"
              fill="none"
              stroke="#F2ECDA"
              strokeWidth={4.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </section>

      <section
        id="next-section"
        className="flex flex-col items-center gap-11 bg-neutral-100 px-[7vw] py-[9vh]"
      >
        <div className="text-center">
          <span className="block text-xs font-bold uppercase tracking-[0.08em] text-neutral-400">
            지금 채워지고 있어요
          </span>
          <h2 className="mt-2.5 text-[clamp(21px,5.6vw,26px)] font-extrabold leading-[1.35] tracking-[-0.02em] text-neutral-900">
            여럿이 나눠서
            <br />
            채우는 중입니다
          </h2>
        </div>

        <div className="flex w-full flex-col gap-3">
          {needs.map((need) => (
            <div
              key={need.id}
              className="flex flex-col gap-2.5 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-neutral-500">
                  {need.category} · {need.foodBank.name}
                </span>
                {need.urgent && (
                  <span className={`shrink-0 ${toneBadge("caution")}`}>도움이 필요해요</span>
                )}
              </div>
              <div className="text-[16px] font-bold text-neutral-900">{need.itemName}</div>
              <div className="flex items-center gap-2.5">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
                  <div className={`h-full rounded-full ${barColor(need.progress)}`} style={{ width: `${need.progress}%` }} />
                </div>
                <span className="text-xs font-bold text-primary-700">{need.progress}%</span>
              </div>
              {need.remainingQty > 0 && (
                <div className="text-xs text-neutral-400">{need.remainingQty}개만 더 모으면 목표를 채워요</div>
              )}
            </div>
          ))}

          <Link
            href="/board"
            className="mt-1 self-center border-b border-primary-700 pb-0.5 text-[13px] font-bold text-primary-700"
          >
            전체 진행 현황 보기 →
          </Link>
        </div>

        <div className="w-full">
          <div className="mb-5 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-neutral-400">어떻게 채워지나요</span>
          </div>
          <div className="relative flex justify-between px-1">
            <div className="absolute left-[13%] right-[13%] top-5 z-0 h-px bg-neutral-200" />

            {[
              {
                label: "사진 등록",
                icon: (
                  <>
                    <path d="M9 4L7.5 6H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-3.5L15 4H9Z" strokeLinejoin="round" />
                    <circle cx="12" cy="13" r="3.4" />
                  </>
                ),
              },
              {
                label: "AI 인식",
                icon: (
                  <>
                    <path d="M12 3v3M12 18v3M4.5 12h3M16.5 12h3M6.5 6.5l2 2M15.5 15.5l2 2M17.5 6.5l-2 2M8.5 15.5l-2 2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="2.6" />
                  </>
                ),
              },
              {
                label: "매칭 확인",
                icon: (
                  <>
                    <circle cx="9.5" cy="12" r="6" />
                    <circle cx="15.5" cy="12" r="6" />
                  </>
                ),
              },
              {
                label: "나눔 신청",
                icon: (
                  <>
                    <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" strokeLinejoin="round" strokeLinecap="round" />
                    <path d="M12.7 13.5 21 3" strokeLinecap="round" />
                  </>
                ),
              },
            ].map((step) => (
              <div key={step.label} className="relative z-10 flex flex-1 flex-col items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50">
                  <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#5D7A2F" strokeWidth={1.6}>
                    {step.icon}
                  </svg>
                </div>
                <span className="text-[11px] font-semibold text-neutral-600">{step.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
