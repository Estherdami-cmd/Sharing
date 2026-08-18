import type { CSSProperties } from "react";

// page.tsx의 <main> 안에 중첩되므로 폭을 명시해야 한다.
// 폭이 없으면 내용(420px 카드) 기준으로 늘어나 좁은 화면에서 가로 스크롤이 생긴다.
export const mainStyle: CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "24px",
};

export const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: "16px",
  padding: "20px",
  maxWidth: "420px",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

export const labelStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#1f2937",
};

export const selectStyle: CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #d1d5db",
  fontSize: "14px",
};

export const inputStyle: CSSProperties = { ...selectStyle };

export const badgeStyle: CSSProperties = {
  background: "#dcfce7",
  color: "#16a34a",
  fontSize: "12px",
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: "999px",
  whiteSpace: "nowrap",
};

const TONE_COLORS = {
  ok: { background: "#dcfce7", color: "#16a34a" },
  caution: { background: "#fef3c7", color: "#d97706" },
  blocked: { background: "#fee2e2", color: "#dc2626" },
};

export function toneBadgeStyle(tone: "ok" | "caution" | "blocked"): CSSProperties {
  return { ...badgeStyle, ...TONE_COLORS[tone] };
}

export function chipStyle(active: boolean): CSSProperties {
  return {
    border: active ? "1px solid #16a34a" : "1px solid #d1d5db",
    background: active ? "#16a34a" : "#ffffff",
    color: active ? "#ffffff" : "#6b7280",
    borderRadius: "999px",
    padding: "6px 0",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
    flex: 1,
  };
}

export function buttonStyle(
  bg: string,
  color: string,
  border: string = "none",
  width?: string
): CSSProperties {
  return {
    background: bg,
    color,
    border,
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    flex: width ? undefined : 1,
    width,
    maxWidth: "100%",
  };
}

export const primaryButtonStyle: CSSProperties = buttonStyle("#16a34a", "#ffffff", "none", "100%");
