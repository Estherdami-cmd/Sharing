"use client";

import { useRef, useState } from "react";
import {
  CATEGORIES,
  DAY_NAMES,
  DEFAULT_REGION,
  SAMPLE_ITEMS,
  TONE_LABEL,
  type ShareVerdict,
  evaluateShareable,
} from "@/lib/rules";
import {
  badgeStyle,
  buttonStyle,
  cardStyle,
  chipStyle,
  inputStyle,
  labelStyle,
  mainStyle,
  primaryButtonStyle,
  selectStyle,
  toneBadgeStyle,
} from "../ui";
import NeedProgress from "./NeedProgress";

type Step = "register" | "match" | "apply" | "complete";
type RecognizeStatus = "idle" | "loading" | "done" | "error";

type Donation = {
  id: string;
  itemName: string;
  category: string;
  expiryDate: string | null;
  shareable: boolean;
  shareReason: string;
  region: string;
};

type MatchResult = {
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
  foodBank: { id: string; name: string; address: string; operatingDays: string[]; pickupSlots: string[] };
  needScore: number;
  needLabel: string;
  needReason: string;
  distanceKm: number;
  rank: number;
  exactMatch: boolean;
};

type DateOption = { date: string; day: string; slot: string; reason: string };

type ApplicationDetail = {
  id: string;
  quantity: number;
  preferredDate: string;
  preferredSlot: string;
  place: string;
  status: "pending" | "accepted" | "rejected";
  receiptRequested: boolean;
  donation: { itemName: string; category: string; expiryDate: string | null };
  foodBank: { name: string };
  need?: {
    itemName: string;
    targetQty: number;
    filledQty: number;
    progress: number;
    remainingQty: number;
    pendingQty: number;
  };
};

const STATUS_LABEL: Record<ApplicationDetail["status"], string> = {
  pending: "기관 확인 대기중",
  accepted: "수락됨",
  rejected: "거절됨",
};
const STATUS_COLOR: Record<ApplicationDetail["status"], string> = {
  pending: "#d97706",
  accepted: "#16a34a",
  rejected: "#dc2626",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "register", label: "1. 물품 등록" },
  { key: "match", label: "2. 매칭 확인" },
  { key: "apply", label: "3. 기부 신청" },
  { key: "complete", label: "4. 신청 완료" },
];

const PLACE_PRESETS = ["기관에 직접 전달", "집 앞 수거", "직접 입력"];
const SLOT_CHOICES = ["상관없음", "오전", "오후"];

const TONE_TEXT_COLOR = { ok: "#16a34a", caution: "#d97706", blocked: "#dc2626" };

const NEED_COLOR: Record<string, string> = {
  "매우 필요": "#16a34a",
  필요: "#d97706",
  여유: "#9ca3af",
};

const subtleTextStyle = { fontSize: "13px", color: "#6b7280" };
const linkButtonStyle = {
  fontSize: "13px",
  color: "#9ca3af",
  background: "none",
  border: "none",
  cursor: "pointer",
};

export default function DonorFlow() {
  const [step, setStep] = useState<Step>("register");

  // 1. 물품 등록
  const [preview, setPreview] = useState<string | null>(null);
  const [recognizeStatus, setRecognizeStatus] = useState<RecognizeStatus>("idle");
  const [demoSample, setDemoSample] = useState("");
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState("");
  const [expiryDate, setExpiryDate] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [submittingDonation, setSubmittingDonation] = useState(false);
  const fileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 2. 매칭 확인
  const [donation, setDonation] = useState<Donation | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  // 3. 기부 신청
  const [selectedFoodBank, setSelectedFoodBank] = useState<MatchResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [placePreset, setPlacePreset] = useState(PLACE_PRESETS[0]);
  const [placeDetail, setPlaceDetail] = useState("");
  const [donorDays, setDonorDays] = useState<string[]>([]);
  const [donorSlot, setDonorSlot] = useState("상관없음");
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredSlot, setPreferredSlot] = useState("");
  const [contact, setContact] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);
  const [submittingApplication, setSubmittingApplication] = useState(false);

  // 4. 신청 완료
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [requestingReceipt, setRequestingReceipt] = useState(false);

  // 서버가 최종 판정하지만, 사용자가 유통기한을 고치면 즉시 반영되도록 같은 규칙을 로컬에서도 돌린다.
  const verdict: ShareVerdict | null =
    recognizeStatus === "done" ? evaluateShareable(expiryDate) : null;

  const place = placePreset === "직접 입력" ? placeDetail : placePreset;

  function handleFileSelected(selected: File | undefined) {
    if (!selected) return;
    fileRef.current = selected;
    setPreview(URL.createObjectURL(selected));
    setRecognizeStatus("idle");
    setItemName("");
    setCategory("");
    setExpiryDate(null);
    setConfidence(null);
    setRegisterError(null);
  }

  async function handleRecognize() {
    if (!fileRef.current) {
      setRegisterError("먼저 사진을 선택해주세요");
      return;
    }
    setRegisterError(null);
    setRecognizeStatus("loading");
    try {
      const formData = new FormData();
      formData.append("image", fileRef.current);
      if (demoSample) formData.append("sample", demoSample);

      const res = await fetch("/api/recognize", { method: "POST", body: formData });
      if (!res.ok) throw new Error("recognize failed");
      const data = await res.json();

      setItemName(data.itemName);
      setCategory(data.category);
      setExpiryDate(data.expiryDate);
      setConfidence(data.confidence);
      setRecognizeStatus("done");
    } catch {
      setRecognizeStatus("error");
      setRegisterError("AI 인식에 실패했어요. 다시 시도해주세요");
    }
  }

  async function loadMatches(donationId: string) {
    setMatchLoading(true);
    const res = await fetch(`/api/match/${donationId}`);
    if (res.ok) {
      const data = await res.json();
      setDonation(data.donation);
      setMatches(data.matches);
      setRegions(data.regions);
    }
    setMatchLoading(false);
  }

  async function handleRegisterNext() {
    setSubmittingDonation(true);
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemName, category, expiryDate, region: DEFAULT_REGION }),
    });
    setSubmittingDonation(false);
    if (!res.ok) {
      setRegisterError("등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    const created = await res.json();
    await loadMatches(created.id);
    setStep("match");
  }

  async function patchDonation(patch: Record<string, unknown>) {
    if (!donation) return;
    await fetch(`/api/donations/${donation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadMatches(donation.id);
  }

  function handleSelectFoodBank(need: MatchResult) {
    setSelectedFoodBank(need);
    setQuantity(1);
    setPlacePreset(PLACE_PRESETS[0]);
    setPlaceDetail("");
    setDonorDays([]);
    setDonorSlot("상관없음");
    setDateOptions([]);
    setSlotMessage(null);
    setPreferredDate("");
    setPreferredSlot("");
    setContact("");
    setApplyError(null);
    setStep("apply");
  }

  function toggleDonorDay(day: string) {
    setDonorDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
    setDateOptions([]);
    setSlotMessage(null);
  }

  async function handleRecommendDates() {
    if (!selectedFoodBank) return;
    setLoadingSlots(true);
    setSlotMessage(null);

    const query = new URLSearchParams({ days: donorDays.join(","), slot: donorSlot });
    if (donation?.expiryDate) query.set("maxDate", donation.expiryDate);

    const res = await fetch(`/api/slots/${selectedFoodBank.foodBank.id}?${query}`);
    setLoadingSlots(false);
    if (!res.ok) return;

    const data = await res.json();
    setDateOptions(data.options);
    setSlotMessage(data.message);
    if (!data.ok) {
      setPreferredDate("");
      setPreferredSlot("");
    }
  }

  function handlePickDate(option: DateOption) {
    setPreferredDate(option.date);
    setPreferredSlot(option.slot);
    setApplyError(null);
  }

  async function handleApplySubmit() {
    setApplyError(null);
    if (!donation || !selectedFoodBank) {
      setApplyError("매칭된 기관 정보가 없어요. 이전 단계로 돌아가주세요");
      return;
    }
    if (!preferredDate) {
      setApplyError("추천 날짜 중 하나를 선택해주세요");
      return;
    }
    if (!place) {
      setApplyError("전달 장소를 입력해주세요");
      return;
    }
    if (!contact) {
      setApplyError("연락처를 입력해주세요");
      return;
    }

    setSubmittingApplication(true);
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        donationId: donation.id,
        needId: selectedFoodBank.id,
        quantity,
        preferredDate,
        preferredSlot,
        place,
        contact,
      }),
    });
    if (!res.ok) {
      setSubmittingApplication(false);
      setApplyError("신청에 실패했어요. 다시 시도해주세요");
      return;
    }
    const created = await res.json();
    const detailRes = await fetch(`/api/applications/${created.id}`);
    setSubmittingApplication(false);
    if (detailRes.ok) {
      setApplication(await detailRes.json());
      setStep("complete");
    }
  }

  async function handleRefreshStatus() {
    if (!application) return;
    setRefreshingStatus(true);
    const res = await fetch(`/api/applications/${application.id}`);
    if (res.ok) setApplication(await res.json());
    setRefreshingStatus(false);
  }

  async function handleReceiptRequest() {
    if (!application) return;
    setRequestingReceipt(true);
    await fetch(`/api/applications/${application.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptRequested: true }),
    });
    const res = await fetch(`/api/applications/${application.id}`);
    if (res.ok) setApplication(await res.json());
    setRequestingReceipt(false);
  }

  function handleRestart() {
    fileRef.current = null;
    setPreview(null);
    setRecognizeStatus("idle");
    setDemoSample("");
    setItemName("");
    setCategory("");
    setExpiryDate(null);
    setConfidence(null);
    setRegisterError(null);
    setDonation(null);
    setMatches([]);
    setSelectedFoodBank(null);
    setApplication(null);
    setStep("register");
  }

  const canGoNext = Boolean(itemName && category && verdict?.shareable);

  return (
    <div style={mainStyle}>
      <StepIndicator step={step} />

      {step === "register" && (
        <>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 800 }}>나눔할 물품을 등록해주세요</h1>
            <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>
              사진 한 장이면 품목과 유통기한을 읽어드려요
            </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "2px dashed #86efac",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "420px",
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
            }}
          >
            {preview ? (
              <img
                src={preview}
                alt="업로드한 물품 미리보기"
                style={{ width: "100%", maxHeight: "260px", objectFit: "cover", borderRadius: "12px" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "180px",
                  borderRadius: "12px",
                  background: "#f0fdf4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ca3af",
                  fontSize: "14px",
                }}
              >
                아직 등록된 사진이 없어요
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", width: "100%" }}>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={buttonStyle("#ffffff", "#16a34a", "2px solid #16a34a")}
              >
                갤러리에서 선택
              </button>
              <button
                onClick={() => cameraInputRef.current?.click()}
                style={buttonStyle("#ffffff", "#16a34a", "2px solid #16a34a")}
              >
                촬영하기
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
              style={{ display: "none" }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
              style={{ display: "none" }}
            />

            <button
              onClick={handleRecognize}
              disabled={recognizeStatus === "loading"}
              style={buttonStyle(
                recognizeStatus === "loading" ? "#a7f3d0" : "#16a34a",
                "#ffffff",
                "none",
                "100%"
              )}
            >
              {recognizeStatus === "loading" ? "사진에서 품목과 유통기한을 읽는 중..." : "AI로 확인하기"}
            </button>

            <div style={{ width: "100%" }}>
              <label style={{ ...labelStyle, display: "block", marginBottom: "6px", color: "#9ca3af" }}>
                데모 모드
              </label>
              <select
                value={demoSample}
                onChange={(e) => setDemoSample(e.target.value)}
                style={{ ...selectStyle, fontSize: "13px" }}
              >
                <option value="">자동 인식 (사진 기준)</option>
                {SAMPLE_ITEMS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {registerError && (
              <p style={{ fontSize: "13px", color: "#dc2626", textAlign: "center" }}>{registerError}</p>
            )}
          </div>

          {recognizeStatus === "done" && verdict && (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "15px", fontWeight: 800 }}>AI 인식 결과</span>
                <span style={toneBadgeStyle(verdict.tone)}>{TONE_LABEL[verdict.tone]}</span>
              </div>

              <label style={labelStyle}>품목명</label>
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                style={inputStyle}
              />

              <label style={labelStyle}>카테고리</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} style={selectStyle}>
                <option value="" disabled>
                  카테고리를 선택하세요
                </option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <label style={labelStyle}>유통기한</label>
              <input
                type="date"
                value={expiryDate ?? ""}
                disabled={expiryDate === null}
                onChange={(e) => setExpiryDate(e.target.value || null)}
                style={{ ...inputStyle, background: expiryDate === null ? "#f9fafb" : "#ffffff" }}
              />
              <label style={{ ...subtleTextStyle, display: "flex", alignItems: "center", gap: "6px" }}>
                <input
                  type="checkbox"
                  checked={expiryDate === null}
                  onChange={(e) => setExpiryDate(e.target.checked ? null : "")}
                />
                유통기한이 없는 품목이에요
              </label>

              <p style={{ fontSize: "13px", fontWeight: 700, color: TONE_TEXT_COLOR[verdict.tone] }}>
                {verdict.reason}
              </p>
              {confidence !== null && (
                <p style={{ fontSize: "12px", color: "#9ca3af" }}>
                  AI 신뢰도 {Math.round(confidence * 100)}%
                </p>
              )}

              {!verdict.shareable && (
                <button onClick={handleRestart} style={buttonStyle("#ffffff", "#dc2626", "1px solid #dc2626", "100%")}>
                  다른 물품 등록하기
                </button>
              )}
            </div>
          )}

          <button
            disabled={!canGoNext || submittingDonation}
            onClick={handleRegisterNext}
            style={buttonStyle(
              canGoNext ? "#1f2937" : "#e5e7eb",
              canGoNext ? "#ffffff" : "#9ca3af",
              "none",
              "420px"
            )}
          >
            {submittingDonation ? "등록 중..." : "다음: 매칭 결과 확인"}
          </button>
        </>
      )}

      {step === "match" && donation && (
        <>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 800 }}>어디에 나눔할까요?</h1>
            <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>
              이 물건이 가장 필요한 곳 순으로 정렬했어요
            </p>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>품목명 (다르면 수정하세요)</label>
            <input
              value={donation.itemName}
              onChange={(e) => setDonation({ ...donation, itemName: e.target.value })}
              onBlur={(e) => patchDonation({ itemName: e.target.value })}
              style={inputStyle}
            />

            <label style={labelStyle}>카테고리</label>
            <select
              value={donation.category}
              onChange={(e) => patchDonation({ category: e.target.value })}
              style={selectStyle}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <label style={labelStyle}>내 지역</label>
            <select
              value={donation.region}
              onChange={(e) => patchDonation({ region: e.target.value })}
              style={selectStyle}
            >
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {matchLoading && <p style={{ textAlign: "center", color: "#6b7280" }}>불러오는 중...</p>}

            {!matchLoading && matches.length > 0 && !matches[0].exactMatch && (
              <p
                style={{
                  fontSize: "13px",
                  color: "#d97706",
                  background: "#fffbeb",
                  border: "1px solid #fde68a",
                  borderRadius: "10px",
                  padding: "10px 12px",
                }}
              >
                {donation.category}를 정확히 요청한 기관이 없어요. 대신 지금 다른 물품을 기다리는 곳을 보여드릴게요
              </p>
            )}

            {matches.map((need) => (
              <div
                key={need.id}
                style={{
                  ...cardStyle,
                  border: need.rank === 1 ? "2px solid #16a34a" : cardStyle.border,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {need.rank === 1 && <span style={badgeStyle}>1순위</span>}
                      {need.urgent && <span style={toneBadgeStyle("blocked")}>긴급</span>}
                    </div>
                    <p style={{ fontWeight: 800, fontSize: "16px", marginTop: "4px" }}>{need.itemName}</p>
                    <p style={{ ...subtleTextStyle, marginTop: "2px" }}>
                      {need.foodBank.name} · {need.distanceKm}km
                    </p>
                    <p style={subtleTextStyle}>운영일: {need.foodBank.operatingDays.join(", ")}</p>
                  </div>
                </div>

                <NeedProgress
                  filledQty={need.filledQty}
                  targetQty={need.targetQty}
                  progress={need.progress}
                  pendingQty={need.pendingQty}
                />

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700 }}>
                  <span style={{ color: "#6b7280" }}>필요도</span>
                  <span style={{ color: NEED_COLOR[need.needLabel] }}>
                    {need.needScore} · {need.needLabel}
                  </span>
                </div>
                <p style={{ fontSize: "13px", color: "#1f2937" }}>{need.needReason}</p>
                {need.note && <p style={{ fontSize: "12px", color: "#9ca3af" }}>{need.note}</p>}

                <button onClick={() => handleSelectFoodBank(need)} style={primaryButtonStyle}>
                  여기에 나눔하기
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setStep("register")} style={linkButtonStyle}>
            ← 물품 등록으로 돌아가기
          </button>
        </>
      )}

      {step === "apply" && selectedFoodBank && (
        <>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 800 }}>나눔 신청</h1>
            <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>
              {selectedFoodBank.foodBank.name}의 {selectedFoodBank.itemName} 목표를 채워요
            </p>
          </div>

          <div style={cardStyle}>
            <NeedProgress
              filledQty={selectedFoodBank.filledQty}
              targetQty={selectedFoodBank.targetQty}
              progress={selectedFoodBank.progress}
              pendingQty={selectedFoodBank.pendingQty}
            />

            <label style={labelStyle}>수량</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              style={inputStyle}
            />
            <p style={{ fontSize: "12px", color: "#9ca3af" }}>
              {quantity}개를 기부하면 진행률이{" "}
              <strong style={{ color: "#16a34a" }}>
                {Math.min(
                  100,
                  Math.round(((selectedFoodBank.filledQty + quantity) / selectedFoodBank.targetQty) * 100)
                )}
                %
              </strong>
              가 돼요
              {selectedFoodBank.remainingQty > 0 && ` · 남은 목표 ${selectedFoodBank.remainingQty}개`}
            </p>

            <label style={labelStyle}>전달 장소</label>
            <select value={placePreset} onChange={(e) => setPlacePreset(e.target.value)} style={selectStyle}>
              {PLACE_PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {placePreset === "직접 입력" && (
              <input
                placeholder="예: 흥해읍 대련리 OO아파트 정문"
                value={placeDetail}
                onChange={(e) => setPlaceDetail(e.target.value)}
                style={inputStyle}
              />
            )}

            <label style={labelStyle}>내가 가능한 요일</label>
            <div style={{ display: "flex", gap: "4px" }}>
              {DAY_NAMES.map((day) => (
                <button key={day} onClick={() => toggleDonorDay(day)} style={chipStyle(donorDays.includes(day))}>
                  {day}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "12px", color: "#9ca3af" }}>
              {donorDays.length === 0 ? "선택 안 하면 아무 요일이나 가능한 걸로 봐요" : `${donorDays.join(", ")}요일`}
            </p>

            <label style={labelStyle}>내가 가능한 시간대</label>
            <select
              value={donorSlot}
              onChange={(e) => {
                setDonorSlot(e.target.value);
                setDateOptions([]);
                setSlotMessage(null);
              }}
              style={selectStyle}
            >
              {SLOT_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p style={{ fontSize: "12px", color: "#9ca3af" }}>
              {selectedFoodBank.foodBank.name} 수거 시간: {selectedFoodBank.foodBank.pickupSlots.join(", ")}
            </p>

            <button
              onClick={handleRecommendDates}
              disabled={loadingSlots}
              style={buttonStyle("#1f2937", "#ffffff", "none", "100%")}
            >
              {loadingSlots ? "가능한 날짜를 찾는 중..." : "AI 추천 날짜 받기"}
            </button>

            {slotMessage && (
              <p
                style={{
                  fontSize: "13px",
                  color: dateOptions.length > 0 ? "#16a34a" : "#d97706",
                }}
              >
                {slotMessage}
              </p>
            )}

            {dateOptions.map((option) => (
              <button
                key={option.date}
                onClick={() => handlePickDate(option)}
                style={{
                  textAlign: "left",
                  border: preferredDate === option.date ? "2px solid #16a34a" : "1px solid #e5e7eb",
                  background: preferredDate === option.date ? "#f0fdf4" : "#ffffff",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  cursor: "pointer",
                }}
              >
                <p style={{ fontSize: "14px", fontWeight: 700 }}>
                  {formatKoreanDate(option.date)} ({option.day}) · {option.slot}
                </p>
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>{option.reason}</p>
              </button>
            ))}

            <label style={labelStyle}>연락처</label>
            <input
              type="tel"
              placeholder="010-0000-0000"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              style={inputStyle}
            />

            {applyError && <p style={{ fontSize: "13px", color: "#dc2626" }}>{applyError}</p>}

            <button onClick={handleApplySubmit} disabled={submittingApplication} style={primaryButtonStyle}>
              {submittingApplication ? "신청 중..." : "나눔 신청하기"}
            </button>
          </div>

          <button onClick={() => setStep("match")} style={linkButtonStyle}>
            ← 매칭 결과로 돌아가기
          </button>
        </>
      )}

      {step === "complete" && application && (
        <>
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "26px", fontWeight: 800 }}>신청 완료</h1>
            <p style={{ fontSize: "15px", color: "#6b7280", marginTop: "8px" }}>기관의 확인을 기다리고 있어요</p>
          </div>

          <div style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: STATUS_COLOR[application.status] }}>
                ● {STATUS_LABEL[application.status]}
              </span>
              <button
                onClick={handleRefreshStatus}
                disabled={refreshingStatus}
                style={{ fontSize: "12px", color: "#16a34a", background: "none", border: "none", cursor: "pointer" }}
              >
                {refreshingStatus ? "확인 중..." : "상태 새로고침"}
              </button>
            </div>

            <label style={labelStyle}>나눔 품목</label>
            <p style={{ fontSize: "14px" }}>
              {application.donation.itemName} ({application.donation.category})
            </p>
            {application.donation.expiryDate && (
              <p style={subtleTextStyle}>유통기한 {application.donation.expiryDate}</p>
            )}

            <label style={labelStyle}>기관 · 채우는 목표</label>
            <p style={{ fontSize: "14px" }}>
              {application.foodBank.name} · {application.need?.itemName}
            </p>
            {application.need && (
              <NeedProgress
                filledQty={application.need.filledQty}
                targetQty={application.need.targetQty}
                progress={application.need.progress}
                pendingQty={application.need.pendingQty}
              />
            )}

            <label style={labelStyle}>수량 / 전달</label>
            <p style={{ fontSize: "14px" }}>
              {application.quantity}개 · {formatKoreanDate(application.preferredDate)}
              {application.preferredSlot && ` ${application.preferredSlot}`}
            </p>
            <p style={subtleTextStyle}>{application.place}</p>

            <label style={labelStyle}>기부금 신청서 작성 여부</label>
            <p style={{ fontSize: "14px", color: application.receiptRequested ? "#16a34a" : "#9ca3af" }}>
              {application.receiptRequested ? "작성 완료" : "미작성"}
            </p>

            {application.status === "accepted" && !application.receiptRequested && (
              <button onClick={handleReceiptRequest} disabled={requestingReceipt} style={primaryButtonStyle}>
                {requestingReceipt ? "요청 중..." : "기부금 영수증 요청"}
              </button>
            )}
          </div>

          <button onClick={handleRestart} style={buttonStyle("#1f2937", "#ffffff", "none", "420px")}>
            처음부터 다시 신청하기
          </button>
        </>
      )}
    </div>
  );
}

function formatKoreanDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

function StepIndicator({ step }: { step: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
      {STEPS.map((s, i) => (
        <span
          key={s.key}
          style={{
            fontSize: "12px",
            fontWeight: 700,
            padding: "6px 12px",
            borderRadius: "999px",
            background: i === currentIndex ? "#16a34a" : i < currentIndex ? "#dcfce7" : "#f3f4f6",
            color: i === currentIndex ? "#ffffff" : i < currentIndex ? "#16a34a" : "#9ca3af",
          }}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}
