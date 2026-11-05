"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";
import Wordmark from "./Wordmark";

/** ui.ts의 btnPrimary는 폼용 풀사이즈 버튼이라 h-14/rounded-xl이 고정돼 있다.
 * 헤더 CTA는 히어로의 알약형 버튼과 같은 크기라 직접 스타일링한다.
 * display(inline-flex/hidden)는 여기 넣지 않고 쓰는 곳마다 직접 준다 — 컴파일된
 * CSS에서 .inline-flex가 .hidden보다 뒤에 나와서, 이 상수에 inline-flex를
 * 박아두면 나중에 hidden을 덧붙여도 항상 inline-flex가 이긴다(모바일에서도 안 숨음). */
const navCta =
  "cursor-pointer items-center justify-center rounded-full bg-primary-700 font-bold text-white transition-all hover:bg-primary-800 active:scale-[0.98]";

const NAV_LINKS = [
  { href: "/board", label: "기부 현황" },
  { href: "/lookup", label: "신청 조회" },
  { href: "/beneficiary", label: "기관 관리" },
  { href: "/service", label: "서비스 소개" },
];

/** 기관 관리처럼 아래에 페이지가 더 있는 메뉴는 그 안에 있을 때도 켜 둔다. */
function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** 로고(좌) · 메뉴 · 우측 CTA. 모바일은 햄버거로 접힘. 스크롤 시 하단 보더가 생긴다. */
export default function Header() {
  const pathname = usePathname();
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

  /*
   * 모바일 메뉴가 열려 있는 동안 배경 스크롤을 잠근다.
   *
   * 예전에는 메뉴가 헤더 높이를 늘렸고, 스크롤하면 메뉴를 닫았다. 그러면 스크롤을
   * 내린 뒤 열 때 늘어난 높이가 페이지를 밀어 스크롤 이벤트를 일으키고, 그 이벤트가
   * 방금 연 메뉴를 바로 닫았다. 지금은 메뉴를 페이지 위에 겹쳐 띄워 밀지 않고,
   * 관성 스크롤 중에 눌러도 닫히지 않도록 스크롤로 닫는 동작을 없앴다.
   *
   * 메뉴를 연 채 넓은 화면으로 바뀌면 메뉴는 안 보이는데 잠금만 남으므로 함께 닫는다.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 768px)");
    function closeOnDesktop() {
      if (desktop.matches) setMenuOpen(false);
    }
    function closeOnEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    desktop.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      root.style.overflow = prevOverflow;
      desktop.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <>
    <header
      className={
        "sticky top-0 z-50 border-b transition-colors " +
        // 메뉴가 열리면 어두운 배경이 헤더에 비치지 않게 불투명하게 둔다.
        (menuOpen ? "bg-neutral-50 " : "bg-neutral-50/85 backdrop-blur-md ") +
        (scrolled ? "border-neutral-200/70" : "border-transparent")
      }
    >
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-5 md:px-6 lg:px-8">
        <Link
          href="/"
          className="flex cursor-pointer items-center gap-0.5"
          onClick={() => setMenuOpen(false)}
        >
          <BrandMark />
          <Wordmark className="h-5 text-primary-700" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                "cursor-pointer rounded-lg px-3 py-2 text-[14px] transition-colors " +
                (isActive(pathname, link.href)
                  ? "font-extrabold text-neutral-900"
                  : "font-bold text-neutral-600 hover:text-neutral-900")
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/donate"
          className={`${navCta} hidden h-10 px-5 text-[14px] md:inline-flex`}
        >
          기부하기
        </Link>

        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={menuOpen}
          className="grid size-10 cursor-pointer place-items-center rounded-lg border-none bg-transparent text-2xl text-neutral-700 md:hidden"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {menuOpen && (
        <nav className="absolute inset-x-0 top-full flex max-h-[calc(100dvh-4rem)] flex-col gap-1 overflow-y-auto border-y border-neutral-200/70 bg-neutral-50 px-5 py-3 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={
                "cursor-pointer rounded-lg px-3 py-2.5 text-[15px] hover:bg-neutral-100 " +
                (isActive(pathname, link.href)
                  ? "font-extrabold text-neutral-900"
                  : "font-bold text-neutral-700")
              }
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/donate"
            onClick={() => setMenuOpen(false)}
            className={`${navCta} mt-1 inline-flex h-12 w-full text-[15px]`}
          >
            기부하기
          </Link>
        </nav>
      )}
    </header>
    {/* 헤더의 backdrop-blur가 fixed 자식의 기준을 헤더로 바꾸므로, 배경은 헤더 밖에 둔다. */}
    {menuOpen && (
      <button
        type="button"
        aria-label="메뉴 닫기"
        tabIndex={-1}
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-40 cursor-default border-none bg-neutral-900/30 md:hidden"
      />
    )}
    </>
  );
}
