"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/rules";
import {
  buttonStyle,
  cardStyle,
  inputStyle,
  labelStyle,
  mainStyle,
  primaryButtonStyle,
  selectStyle,
  toneBadgeStyle,
} from "../ui";
import NeedProgress from "./NeedProgress";

type FoodBank = { id: string; name: string };

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
  foodBank: { id: string; name: string };
};

type ApplicationRow = {
  id: string;
  quantity: number;
  preferredDate: string;
  preferredSlot: string;
  place: string;
  contact: string;
  status: "pending" | "accepted" | "rejected";
  receiptRequested: boolean;
  donation: { itemName: string; category: string; expiryDate: string | null };
  foodBank: { name: string };
  need?: { itemName: string; progress: number };
};

const STATUS_BADGE = {
  pending: { tone: "caution", label: "대기중" },
  accepted: { tone: "ok", label: "수락됨" },
  rejected: { tone: "blocked", label: "거절됨" },
} as const;

export default function AdminPanel({ refreshKey }: { refreshKey: number }) {
  const [foodBanks, setFoodBanks] = useState<FoodBank[]>([]);
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [foodBankId, setFoodBankId] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetQty, setTargetQty] = useState(50);
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const [needsRes, appsRes] = await Promise.all([fetch("/api/needs"), fetch("/api/applications")]);
    if (needsRes.ok) {
      const data = await needsRes.json();
      setNeeds(data.needs);
      setFoodBanks(data.foodBanks);
      setFoodBankId((prev) => prev || data.foodBanks[0]?.id || "");
    }
    if (appsRes.ok) setApplications(await appsRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  async function handleCreateNeed() {
    setFormError(null);
    if (!itemName.trim()) {
      setFormError("품목명을 입력해주세요");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/needs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodBankId, itemName, category, targetQty, urgent, note }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError("등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    setItemName("");
    setTargetQty(50);
    setUrgent(false);
    setNote("");
    load();
  }

  async function handleDecision(id: string, status: "accepted" | "rejected") {
    await fetch(`/api/applications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div style={mainStyle}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: "26px", fontWeight: 800 }}>기관 관리</h1>
        <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>
          필요한 물품을 올리고, 들어온 신청을 확인해요
        </p>
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

      <div style={{ ...cardStyle, maxWidth: "440px", border: "2px solid #86efac" }}>
        <p style={{ fontSize: "16px", fontWeight: 800 }}>필요 물품 올리기</p>
        <p style={{ fontSize: "12px", color: "#9ca3af" }}>
          목표 수량을 정하면 기부자들이 나눠서 채워요
        </p>

        <label style={labelStyle}>우리 기관</label>
        <select value={foodBankId} onChange={(e) => setFoodBankId(e.target.value)} style={selectStyle}>
          {foodBanks.map((fb) => (
            <option key={fb.id} value={fb.id}>
              {fb.name}
            </option>
          ))}
        </select>

        <label style={labelStyle}>필요한 품목</label>
        <input
          placeholder="예: 성인용 기저귀 대형"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          style={inputStyle}
        />

        <label style={labelStyle}>카테고리</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label style={labelStyle}>목표 수량</label>
        <input
          type="number"
          min={1}
          value={targetQty}
          onChange={(e) => setTargetQty(Math.max(1, Number(e.target.value)))}
          style={inputStyle}
        />

        <label style={labelStyle}>안내 문구 (선택)</label>
        <input
          placeholder="예: 요양 어르신 12분께 매주 전달돼요"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={inputStyle}
        />

        <label style={{ fontSize: "13px", color: "#6b7280", display: "flex", alignItems: "center", gap: "6px" }}>
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
          긴급으로 표시 (추천 상단에 노출)
        </label>

        {formError && <p style={{ fontSize: "13px", color: "#dc2626" }}>{formError}</p>}

        <button onClick={handleCreateNeed} disabled={submitting} style={primaryButtonStyle}>
          {submitting ? "등록 중..." : "필요 물품 등록"}
        </button>
      </div>

      <div style={{ width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ fontSize: "16px", fontWeight: 800 }}>등록한 요청 · 진행률</p>
        {loading && <p style={{ textAlign: "center", color: "#6b7280" }}>불러오는 중...</p>}
        {needs.map((need) => (
          <div key={need.id} style={{ ...cardStyle, maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
              <div>
                <p style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700 }}>{need.foodBank.name}</p>
                <p style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>{need.itemName}</p>
                <p style={{ fontSize: "12px", color: "#9ca3af" }}>{need.category}</p>
              </div>
              {need.urgent && <span style={toneBadgeStyle("blocked")}>긴급</span>}
            </div>
            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
            />
            {need.note && <p style={{ fontSize: "12px", color: "#9ca3af" }}>{need.note}</p>}
          </div>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <p style={{ fontSize: "16px", fontWeight: 800 }}>들어온 신청</p>
        {!loading && applications.length === 0 && (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "14px" }}>아직 들어온 신청이 없어요</p>
        )}
        {applications.map((app) => (
          <div key={app.id} style={{ ...cardStyle, maxWidth: "440px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: "15px" }}>{app.foodBank.name}</p>
                {app.need && (
                  <p style={{ fontSize: "13px", color: "#16a34a", fontWeight: 700 }}>
                    {app.need.itemName} 목표 채우기 (현재 {app.need.progress}%)
                  </p>
                )}
                <p style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px" }}>
                  {app.donation.itemName} ({app.donation.category}) · {app.quantity}개
                </p>
                {app.donation.expiryDate && (
                  <p style={{ fontSize: "13px", color: "#6b7280" }}>유통기한: {app.donation.expiryDate}</p>
                )}
                <p style={{ fontSize: "13px", color: "#6b7280" }}>
                  희망일: {app.preferredDate} {app.preferredSlot}
                </p>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>전달 장소: {app.place}</p>
                <p style={{ fontSize: "13px", color: "#6b7280" }}>연락처: {app.contact}</p>
                {app.receiptRequested && (
                  <p style={{ fontSize: "13px", color: "#16a34a" }}>기부금 신청서 작성 요청됨</p>
                )}
              </div>
              <span style={toneBadgeStyle(STATUS_BADGE[app.status].tone)}>
                {STATUS_BADGE[app.status].label}
              </span>
            </div>

            {app.status === "pending" && (
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={() => handleDecision(app.id, "accepted")} style={buttonStyle("#16a34a", "#ffffff")}>
                  수락 (진행률 +{app.quantity})
                </button>
                <button
                  onClick={() => handleDecision(app.id, "rejected")}
                  style={buttonStyle("#ffffff", "#dc2626", "1px solid #dc2626")}
                >
                  거절
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
