import Link from "next/link";

const STEPS = ["물품 등록", "기관 선택", "나눔 신청", "신청 완료"] as const;

/**
 * 기부하기 흐름(등록 → 기관 선택 → 신청 → 완료) 화면 위에 얹는 뒤로가기 + 단계 막대.
 *
 * 뒤로가기는 router.back()이 아니라 흐름상 앞 단계의 주소로 고정한다. 각 단계가 독립
 * 주소라 링크로 바로 들어오거나 새로고침한 경우에도 같은 곳으로 가야 하기 때문이다
 * (히스토리로 가면 사이트 밖으로 나가 버릴 수 있다). backHref가 없으면 버튼을 숨긴다.
 */
export default function StepHeader({
  step,
  backHref,
}: {
  /** 1부터 시작하는 현재 단계. */
  step: 1 | 2 | 3 | 4;
  backHref?: string;
}) {
  return (
    <nav aria-label="기부 진행 단계" className="mx-auto flex w-full max-w-lg flex-col gap-2.5">
      <div className="flex h-9 items-center justify-between">
        {backHref ? (
          <Link
            href={backHref}
            className="-ml-2 inline-flex h-9 items-center gap-1 rounded-lg px-2 text-[14px] font-semibold text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            뒤로
          </Link>
        ) : (
          <span />
        )}
        <p className="text-[13px] font-semibold text-neutral-500">
          <span className="text-primary-700">{step}</span> / {STEPS.length}
          <span className="mx-1.5 text-neutral-300">·</span>
          <span className="text-neutral-800">{STEPS[step - 1]}</span>
        </p>
      </div>
      <ol className="flex gap-1.5">
        {STEPS.map((name, i) => {
          const done = i < step;
          return (
            <li
              key={name}
              aria-current={i === step - 1 ? "step" : undefined}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-900/10"
            >
              <span className="sr-only">
                {i + 1}단계 {name}
                {i < step - 1 ? " (완료)" : ""}
              </span>
              {done && <span aria-hidden="true" className="block h-full rounded-full bg-primary-600" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
