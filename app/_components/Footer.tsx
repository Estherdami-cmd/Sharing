import Link from "next/link";
import BrandMark from "./BrandMark";
import Wordmark from "./Wordmark";

/*
 * 푸터는 링크가 6개뿐이라 3열로 나눌 만큼 많지 않다. 예전에는 "서비스 / 문의 /
 * 법적고지"로 갈라 놨는데, "문의" 칸에는 링크가 하나뿐이라 제목이 링크보다 더
 * 자리를 차지했다. 제목 없이 한 줄로 늘어놓는 편이 훑기도 쉽다.
 *
 * 이용약관·개인정보처리방침은 이 목록과 맨 아래 저작권 줄에 똑같이 한 번씩,
 * 모두 두 번 있었다. 여기 한 번만 둔다.
 */
const LINKS: { href: string; label: string }[] = [
  { href: "/donate", label: "기부하기" },
  { href: "/board", label: "진행 현황" },
  { href: "/service", label: "서비스 소개" },
  { href: "/contact", label: "문의하기" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
];

/*
 * 역할(대표·PM·QA…)을 같이 적으면 한 사람이 두 줄을 쓴다. 여섯 명이면 항목이
 * 12개가 되어 푸터에서 가장 큰 덩어리가 됐다. 이름만 한 줄로 늘어놓는다.
 */
const MAKERS = ["정유담", "황수진", "김성진", "이하나", "김기우", "김원진"];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200/70 bg-neutral-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-5 py-8 md:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-0.5">
              <BrandMark />
              <Wordmark className="h-5 text-primary-700" />
            </div>
            <p className="mt-2 break-keep text-[13px] leading-relaxed text-neutral-500">
              사진 한장으로 필요로 하는 곳에 함께 모여 기부합니다.
            </p>
          </div>

          {/* 좁은 화면에서는 줄바꿈되며 두 줄이 된다. 제목이 없으니 그래도 읽힌다. */}
          <nav className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="whitespace-nowrap text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-neutral-200/70 pt-5 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-keep">
            <span className="font-bold text-neutral-500">만든 사람들</span>{" "}
            {MAKERS.join(" · ")}
          </p>
          <p className="whitespace-nowrap">© 2026 여러시</p>
        </div>
      </div>
    </footer>
  );
}
