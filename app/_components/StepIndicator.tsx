export type Step = "register" | "match" | "apply" | "complete";

export const STEPS: { key: Step; label: string }[] = [
  { key: "register", label: "1. 물품 등록" },
  { key: "match", label: "2. 매칭 확인" },
  { key: "apply", label: "3. 기부 신청" },
  { key: "complete", label: "4. 신청 완료" },
];

/** /donate, /apply 두 페이지에서 같은 4단계 진행 표시를 공유한다. */
export default function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {STEPS.map((s, i) => (
        <span
          key={s.key}
          className={
            "rounded-full px-3 py-1.5 text-xs font-bold transition-colors " +
            (i === currentIndex
              ? "bg-neutral-900 text-white"
              : i < currentIndex
                ? "bg-primary-100 text-primary-700"
                : "bg-neutral-100 text-neutral-400")
          }
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
