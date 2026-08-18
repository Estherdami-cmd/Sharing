/**
 * 이 서비스에서 가장 많이 반복되는 요소라 별도 컴포넌트로 뺐다.
 * 낮은 진행률에 빨강을 쓰는 건 의도적이다 — 0%가 회색이면 "아무도 관심 없는 요청"으로
 * 보이지만, 빨강이면 "여기가 제일 급하다"로 읽힌다.
 */

function fillClass(progress: number) {
  if (progress >= 100) return "bg-success-fg";
  if (progress >= 60) return "bg-primary-600";
  if (progress >= 30) return "bg-primary-500";
  return "bg-danger-fg";
}

function textClass(progress: number) {
  if (progress >= 100) return "text-success-fg";
  if (progress >= 60) return "text-primary-700";
  if (progress >= 30) return "text-primary-700";
  return "text-danger-fg";
}

export default function NeedProgress({
  filledQty,
  targetQty,
  progress,
  pendingQty = 0,
}: {
  filledQty: number;
  targetQty: number;
  progress: number;
  pendingQty?: number;
}) {
  const pendingWidth = Math.min(100 - progress, Math.round((pendingQty / targetQty) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-[13px] text-neutral-500">
          <span className="tabular text-2xl font-extrabold tracking-[-0.02em] text-neutral-900">
            {filledQty}
          </span>
          <span className="mx-1">/</span>
          {targetQty}개 채워짐
        </p>
        <span className={`tabular text-[17px] font-extrabold ${textClass(progress)}`}>{progress}%</span>
      </div>

      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        <div
          className={`${fillClass(progress)} rounded-full transition-[width] duration-500 ease-out`}
          style={{ width: `${progress}%` }}
        />
        {pendingWidth > 0 && (
          <div
            className="opacity-30 transition-[width] duration-500 ease-out"
            style={{
              width: `${pendingWidth}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, currentColor 0 4px, transparent 4px 8px)",
              color: "var(--color-neutral-900)",
            }}
          />
        )}
      </div>

      {pendingQty > 0 && (
        <p className="text-xs text-neutral-400">
          기관 확인 대기중 {pendingQty}개 포함 시 {Math.min(100, progress + pendingWidth)}%
        </p>
      )}
    </div>
  );
}
