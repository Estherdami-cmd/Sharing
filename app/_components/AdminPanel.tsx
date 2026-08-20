"use client";

import { useEffect, useState } from "react";
import { CATEGORIES } from "@/lib/rules";
import type { ApplicationDetail, FoodBank, NeedView } from "@/lib/store";
import NeedProgress from "./NeedProgress";
import {
  btnDanger,
  btnGhost,
  btnOutline,
  btnPrimary,
  card,
  caption,
  field,
  label,
  pageDesc,
  pageTitle,
  sectionTitle,
  toneBadge,
} from "../ui";

type ApplicationRow = ApplicationDetail;

const STATUS_BADGE = {
  pending: { tone: "caution", label: "대기중" },
  accepted: { tone: "ok", label: "수락됨" },
  rejected: { tone: "blocked", label: "거절됨" },
} as const;

export default function AdminPanel() {
  const [foodBanks, setFoodBanks] = useState<FoodBank[]>([]);
  const [needs, setNeeds] = useState<NeedView[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [foodBankId, setFoodBankId] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [targetQty, setTargetQty] = useState(50);
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
  }, []);

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
      body: JSON.stringify({ foodBankId, itemName, category, targetQty, note }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setFormError("등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    setItemName("");
    setTargetQty(50);
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
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <h1 className={pageTitle}>기관 관리</h1>
        <p className={pageDesc}>필요한 물품을 올리고, 들어온 신청을 확인해요</p>
        <button onClick={load} className={`${btnGhost} mt-2`}>
          새로고침
        </button>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary-500 bg-white p-5">
            <div>
              <h2 className={sectionTitle}>필요 물품 올리기</h2>
              <p className={`${caption} mt-1`}>목표 수량을 정하면 기부자들이 나눠서 채워요</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>우리 기관</label>
              <select
                value={foodBankId}
                onChange={(e) => setFoodBankId(e.target.value)}
                className={field}
              >
                {foodBanks.map((fb) => (
                  <option key={fb.id} value={fb.id}>
                    {fb.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>필요한 품목</label>
              <input
                placeholder="예: 성인용 기저귀 대형"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                className={field}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>목표 수량</label>
              <input
                type="number"
                min={1}
                value={targetQty}
                onChange={(e) => setTargetQty(Math.max(1, Number(e.target.value)))}
                className={field}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>안내 문구 (선택)</label>
              <input
                placeholder="예: 요양 어르신 12분께 매주 전달돼요"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={field}
              />
            </div>

            <p className={caption}>
              "도움이 필요해요" 표시는 진행률 30% 미만인 요청에 자동으로 붙어요
            </p>

            {formError && <p className="text-[13px] text-danger-fg">{formError}</p>}

            <button onClick={handleCreateNeed} disabled={submitting} className={btnPrimary}>
              {submitting ? "등록 중..." : "필요 물품 등록"}
            </button>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className={sectionTitle}>등록한 요청 · 진행률</h2>
            {loading && <p className="text-[15px] text-neutral-500">불러오는 중...</p>}
            {needs.map((need) => (
              <article key={need.id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary-700">{need.foodBank.name}</p>
                    <h3 className="mt-0.5 text-[17px] font-bold tracking-[-0.02em]">
                      {need.itemName}
                    </h3>
                    <p className="text-xs text-neutral-400">{need.category}</p>
                  </div>
                  {need.urgent && <span className={toneBadge("caution")}>도움이 필요해요</span>}
                </div>
                <NeedProgress
                  filledQty={need.filledQty}
                  targetQty={need.targetQty}
                  progress={need.progress}
                  pendingQty={need.pendingQty}
                />
                {need.note && <p className={caption}>{need.note}</p>}
              </article>
            ))}
          </section>
        </div>

        <section className="flex flex-col gap-3">
          <h2 className={sectionTitle}>들어온 신청</h2>

          {!loading && applications.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <img
                src="https://picsum.photos/seed/empty-apply/240/180"
                alt="들어온 신청이 없는 상태를 나타내는 이미지"
                className="w-60 rounded-2xl opacity-40 grayscale"
              />
              <p className="text-[15px] text-neutral-400">아직 들어온 신청이 없어요</p>
            </div>
          )}

          {applications.map((app) => (
            <article key={app.id} className={card}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">{app.foodBank.name}</p>
                  {app.need && (
                    <p className="mt-0.5 text-[13px] font-bold text-primary-700">
                      {app.need.itemName} 목표 채우기 (현재 {app.need.progress}%)
                    </p>
                  )}
                  <p className="mt-1.5 text-[13px] text-neutral-600">
                    {app.donation.itemName} ({app.donation.category}) · {app.quantity}개
                  </p>
                  {app.donation.expiryDate && (
                    <p className="text-[13px] text-neutral-500">
                      유통기한: {app.donation.expiryDate}
                    </p>
                  )}
                  <p className="text-[13px] text-neutral-500">
                    희망일: {app.preferredDate} {app.preferredSlot}
                  </p>
                  <p className="text-[13px] text-neutral-500">전달 장소: {app.place}</p>
                  <p className="text-[13px] text-neutral-500">연락처: {app.contact}</p>
                  {app.receiptRequested && (
                    <p className="mt-1 text-[13px] font-semibold text-success-fg">
                      기부금 신청서 작성 요청됨
                    </p>
                  )}
                </div>
                <span className={toneBadge(STATUS_BADGE[app.status].tone)}>
                  {STATUS_BADGE[app.status].label}
                </span>
              </div>

              {app.status === "pending" && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecision(app.id, "accepted")}
                    className={`${btnOutline} border-primary-500 text-primary-700 hover:border-primary-600`}
                  >
                    수락 (진행률 +{app.quantity})
                  </button>
                  <button onClick={() => handleDecision(app.id, "rejected")} className={btnDanger}>
                    거절
                  </button>
                </div>
              )}
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
