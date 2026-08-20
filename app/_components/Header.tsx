"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** ui.ts의 btnPrimary는 폼용 풀사이즈 버튼이라 h-14/rounded-xl이 고정돼 있다.
 * 헤더 CTA는 히어로의 알약형 버튼과 같은 크기라 직접 스타일링한다. */
const navCta =
  "inline-flex cursor-pointer items-center justify-center rounded-full bg-primary-700 font-bold text-white transition-all hover:bg-primary-800 active:scale-[0.98]";

const NAV_LINKS = [
  { href: "/donate", label: "기부하기" },
  { href: "/board", label: "진행 현황" },
  { href: "/service", label: "서비스 소개" },
];

/** 로고(좌) · 메뉴 · 우측 CTA. 모바일은 햄버거로 접힘. 스크롤 시 하단 보더가 생긴다. */
export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 0);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "sticky top-0 z-50 border-b bg-neutral-50/85 backdrop-blur-md transition-colors " +
        (scrolled ? "border-neutral-200/70" : "border-transparent")
      }
    >
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 md:px-6 lg:px-8">
        <Link href="/" className="flex cursor-pointer items-center gap-2" onClick={() => setMenuOpen(false)}>
          <span className="grid size-7 place-items-center rounded-lg bg-primary-500 text-sm font-extrabold text-neutral-900">
            나
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.03em]">나눔곳간</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="cursor-pointer rounded-lg px-3 py-2 text-[14px] font-bold text-neutral-600 transition-colors hover:text-neutral-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link href="/donate" className={`${navCta} hidden h-10 px-5 text-[14px] md:inline-flex`}>
          기부하기
        </Link>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="메뉴 열기"
          aria-expanded={menuOpen}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border-none bg-transparent text-2xl text-neutral-700 md:hidden"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 border-t border-neutral-200/70 bg-neutral-50 px-5 py-3 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="cursor-pointer rounded-lg px-3 py-2.5 text-[15px] font-bold text-neutral-700 hover:bg-neutral-100"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/donate"
            onClick={() => setMenuOpen(false)}
            className={`${navCta} mt-1 h-12 w-full text-[15px]`}
          >
            기부하기
          </Link>
        </nav>
      )}
    </header>
  );
}
