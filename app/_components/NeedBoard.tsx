"use client";

import { useEffect, useState } from "react";
import { badgeStyle, cardStyle, mainStyle, toneBadgeStyle } from "../ui";
import NeedProgress from "./NeedProgress";

type NeedView = {
  id: string;
  itemName: string;
  category: string;
  targetQty: number;
  filledQty: number;
  progress: number;
  remainingQty: number;
  pendingQty: number;
  urgent: boolean;
  note: string;
  foodBank: { name: string; address: string };
};

export default function NeedBoard({ refreshKey }: { refreshKey: number }) {
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/needs");
    if (res.ok) setNeeds((await res.json()).needs);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  const totalTarget = needs.reduce((sum, n) => sum + n.targetQty, 0);
  const totalFilled = needs.reduce((sum, n) => sum + n.filledQty, 0);

  return (
    <div style={mainStyle}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800 }}>지금 필요한 것들</h1>
        <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>
          기관이 올린 목표를 여럿이 나눠 채우고 있어요
        </p>
        {totalTarget > 0 && (
          <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 700, marginTop: "6px" }}>
            전체 {totalFilled} / {totalTarget}개 · 요청 {needs.length}건
          </p>
        )}
        <button
          onClick={load}
          style={{
            fontSize: "12px",
            color: "#16a34a",
            background: "none",
            border: "none",
            cursor: "pointer",
            marginTop: "6px",
          }}
        >
          새로고침
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {loading && <p style={{ textAlign: "center", color: "#6b7280" }}>불러오는 중...</p>}
        {!loading && needs.length === 0 && (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>
            아직 등록된 요청이 없어요
          </p>
        )}

        {needs.map((need) => (
          <div
            key={need.id}
            style={{ ...cardStyle, maxWidth: "440px", border: need.urgent ? "2px solid #fca5a5" : cardStyle.border }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "#16a34a" }}>{need.foodBank.name}</p>
                <p style={{ fontSize: "17px", fontWeight: 800, marginTop: "2px" }}>{need.itemName}</p>
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>
                  {need.category} · {need.foodBank.address}
                </p>
              </div>
              {need.urgent ? (
                <span style={toneBadgeStyle("blocked")}>긴급</span>
              ) : need.progress >= 100 ? (
                <span style={badgeStyle}>목표 달성</span>
              ) : null}
            </div>

            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
            />

            {need.remainingQty > 0 && (
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#1f2937" }}>
                {need.remainingQty}개만 더 모으면 목표를 채워요
              </p>
            )}
            {need.note && <p style={{ fontSize: "12px", color: "#9ca3af" }}>{need.note}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
