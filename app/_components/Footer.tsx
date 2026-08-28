import Link from "next/link";
import BrandMark from "./BrandMark";
import Wordmark from "./Wordmark";

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

const MAKERS: { role: string; name: string }[] = [
  { role: "대표", name: "정유담" },
  { role: "PM", name: "황수진" },
  { role: "QA", name: "김성진" },
  { role: "디자인", name: "이하나" },
  { role: "배포", name: "김기우" },
  { role: "빌더", name: "김원진" },
];

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200/70 bg-neutral-50">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-10 md:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="flex items-center gap-0.5">
              <BrandMark />
              <Wordmark className="h-5 text-primary-700" />
            </div>
            {/*
              한 줄로 보이는 건 유지하되 whitespace-nowrap은 쓰지 않는다.

              전에 break-keep으로 바꿨더니 두 줄이 된 건 같이 붙어 있던 max-w-xs(320px)
              때문이었다. 폭을 320px로 묶어놨으니 글이 접힐 수밖에 없었다. max-w-xs를
              빼고 break-keep만 두면, 자리가 있는 한 계속 한 줄이다.

              nowrap은 접힐 수가 없어서 여유가 0이다. 실측하면 기본 13px에서 글자가
              269px라 320px 화면에 겨우 들어가는데, 사용자가 글자 크기를 키우거나
              Pretendard가 안 떠서 폴백 폰트로 그려지면 바로 화면 밖으로 나간다
              (320px 기기에서 15px면 11px, 17px면 53px 넘침).
            */}
            <p className="mt-2 break-keep text-[13px] leading-relaxed text-neutral-500">
              사진 한장으로 필요로 하는 곳에 함께 모여 기부합니다.
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

        <div className="border-t border-neutral-200/70 pt-6">
          <div>
            <p className="text-xs font-bold text-neutral-400">만든 사람들</p>
            <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6 sm:gap-x-6">
              {MAKERS.map((maker) => (
                <li key={maker.name} className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-bold text-neutral-400">{maker.role}</span>
                  <span className="text-[13px] font-semibold text-neutral-600">{maker.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex flex-col gap-2 text-xs text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
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
      </div>
    </footer>
  );
}
