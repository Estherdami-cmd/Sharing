export function progressColor(progress: number) {
  if (progress >= 100) return "#16a34a";
  if (progress >= 60) return "#22c55e";
  if (progress >= 30) return "#d97706";
  return "#dc2626";
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
  const color = progressColor(progress);
  const pendingWidth = Math.min(100 - progress, Math.round((pendingQty / targetQty) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "13px", color: "#6b7280" }}>
          <strong style={{ fontSize: "16px", color: "#1f2937" }}>{filledQty}</strong>
          {" / "}
          {targetQty}개 채워짐
        </span>
        <span style={{ fontSize: "15px", fontWeight: 800, color }}>{progress}%</span>
      </div>

      <div
        style={{
          display: "flex",
          height: "10px",
          background: "#f3f4f6",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div style={{ width: `${progress}%`, background: color }} />
        {pendingWidth > 0 && (
          <div
            style={{
              width: `${pendingWidth}%`,
              background: `repeating-linear-gradient(45deg, ${color}55, ${color}55 4px, transparent 4px, transparent 8px)`,
            }}
          />
        )}
      </div>

      {pendingQty > 0 && (
        <span style={{ fontSize: "12px", color: "#9ca3af" }}>
          기관 확인 대기중 {pendingQty}개 포함 시 {Math.min(100, progress + pendingWidth)}%
        </span>
      )}
    </div>
  );
}
