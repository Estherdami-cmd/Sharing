import Link from "next/link";
import BrandMark from "./BrandMark";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "서비스",
    links: [
      { href: "/donate", label: "기부하기" },
      { href: "/board", label: "진행 현황" },
      { href: "/service", label: "서비스 소개" },
    ],
  },
  {
    title: "문의",
    links: [{ href: "/contact", label: "문의하기" }],
  },
  {
    title: "법적고지",
    links: [
      { href: "/terms", label: "이용약관" },
      { href: "/privacy", label: "개인정보처리방침" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200/70 bg-neutral-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <BrandMark />
              <span className="text-[15px] font-extrabold tracking-[-0.02em] whitespace-nowrap">
                YEORESI <span className="font-bold text-neutral-500">(여러시)</span>
              </span>
            </div>
            <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-neutral-500">
              기관이 먼저 필요를 밝히면, 여럿이 나눠서 채우는 나눔 서비스예요.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 sm:gap-10">
            {COLUMNS.map((col) => (
              <div key={col.title} className="flex flex-col gap-2">
                <p className="text-xs font-bold text-neutral-400">{col.title}</p>
                {col.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-[13px] font-semibold text-neutral-600 hover:text-neutral-900"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-neutral-200/70 pt-6 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 여러시. All rights reserved.</p>
          <div className="flex gap-3">
            <Link href="/terms" className="hover:text-neutral-600">
              이용약관
            </Link>
            <span aria-hidden>·</span>
            <Link href="/privacy" className="hover:text-neutral-600">
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
