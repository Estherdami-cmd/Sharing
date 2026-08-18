"use client";

import { useRef, useState } from "react";
import {
  CATEGORIES,
  DAY_NAMES,
  DEFAULT_REGION,
  SAMPLE_ITEMS,
  type ShareVerdict,
  evaluateShareable,
} from "@/lib/rules";
import NeedProgress from "./NeedProgress";
import {
  TONE_LABEL,
  TONE_TEXT,
  btnDanger,
  btnGhost,
  btnOutline,
  btnPrimary,
  btnSecondary,
  card,
  cardHighlight,
  caption,
  chip,
  field,
  label,
  pageDesc,
  pageTitle,
  rankBadge,
  toneBadge,
} from "../ui";

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
const STATUS_TEXT: Record<ApplicationDetail["status"], string> = {
  pending: "text-warning-fg",
  accepted: "text-success-fg",
  rejected: "text-danger-fg",
};

const STEPS: { key: Step; label: string }[] = [
  { key: "register", label: "1. 물품 등록" },
  { key: "match", label: "2. 매칭 확인" },
  { key: "apply", label: "3. 기부 신청" },
  { key: "complete", label: "4. 신청 완료" },
];

/**
 * 발표용으로 번들해 둔 실제 제품 사진(냉동 치즈볼생지, 소비기한 2027-03-09).
 * 파일명은 rules.ts의 dough 샘플 keywords와 맞춰뒀다. Gemini 호출이 실패해
 * 목업으로 떨어져도 같은 품목·같은 분기(나눔 가능)가 나와 시연이 안 끊긴다.
 */
const DEMO_PHOTO = { src: "/demo/cheese-dough.jpg", fileName: "cheese-dough.jpg" };

const PLACE_PRESETS = ["기관에 직접 전달", "집 앞 수거", "직접 입력"];
const SLOT_CHOICES = ["상관없음", "오전", "오후"];

/** 필요도가 낮으면 흐리게. 선택은 가능하되 권하지 않는다는 뜻. */
const NEED_TEXT: Record<string, string> = {
  "매우 필요": "text-primary-700",
  필요: "text-neutral-700",
  여유: "text-neutral-400",
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
  const [source, setSource] = useState<"demo" | "gemini" | "mock" | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [submittingDonation, setSubmittingDonation] = useState(false);
  const [loadingDemoPhoto, setLoadingDemoPhoto] = useState(false);
  const fileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 2. 매칭 확인
  const [donation, setDonation] = useState<Donation | null>(null);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);

  // 3. 기부 신청
  const [selectedNeed, setSelectedNeed] = useState<MatchResult | null>(null);
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
  const canGoNext = Boolean(itemName && category && verdict?.shareable);

  function handleFileSelected(selected: File | undefined) {
    if (!selected) return;
    fileRef.current = selected;
    setPreview(URL.createObjectURL(selected));
    setRecognizeStatus("idle");
    setItemName("");
    setCategory("");
    setExpiryDate(null);
    setConfidence(null);
    setSource(null);
    setRegisterError(null);
  }

  /** 발표 중 파일 탐색기를 여는 대신 번들된 사진을 바로 집어넣는다. */
  async function handleUseDemoPhoto() {
    setLoadingDemoPhoto(true);
    try {
      const res = await fetch(DEMO_PHOTO.src);
      if (!res.ok) throw new Error("demo photo fetch failed");
      const blob = await res.blob();
      handleFileSelected(new File([blob], DEMO_PHOTO.fileName, { type: blob.type || "image/jpeg" }));
      // 예시 사진은 실제 AI가 읽는 걸 보여주는 용도라 데모 모드 지정은 풀어준다.
      setDemoSample("");
    } catch {
      setRegisterError("예시 사진을 불러오지 못했어요");
    } finally {
      setLoadingDemoPhoto(false);
    }
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
      if (!res.ok) {
        // 서버가 이유를 적어 보내면(물품을 못 찾음, 사진이 너무 큼) 그 문장을 그대로 쓴다.
        const body = await res.json().catch(() => null);
        setRecognizeStatus("error");
        setRegisterError(body?.error ?? "AI 인식에 실패했어요. 다시 시도해주세요");
        return;
      }
      const data = await res.json();

      setItemName(data.itemName);
      setCategory(data.category);
      setExpiryDate(data.expiryDate);
      setConfidence(data.confidence);
      setSource(data.source ?? null);
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

  function handleSelectNeed(need: MatchResult) {
    setSelectedNeed(need);
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
    if (!selectedNeed) return;
    setLoadingSlots(true);
    setSlotMessage(null);

    const query = new URLSearchParams({ days: donorDays.join(","), slot: donorSlot });
    if (donation?.expiryDate) query.set("maxDate", donation.expiryDate);

    const res = await fetch(`/api/slots/${selectedNeed.foodBank.id}?${query}`);
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
    if (!donation || !selectedNeed) {
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
        needId: selectedNeed.id,
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
    setSource(null);
    setRegisterError(null);
    setDonation(null);
    setMatches([]);
    setSelectedNeed(null);
    setApplication(null);
    setStep("register");
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator step={step} />

      {step === "register" && (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <header className="text-center">
            <h1 className={pageTitle}>나눔할 물품을 등록해주세요</h1>
            <p className={pageDesc}>사진 한 장이면 품목과 유통기한을 읽어드려요</p>
          </header>

          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary-300 bg-primary-50/60 p-5">
            {preview ? (
              <img
                src={preview}
                alt="업로드한 물품 미리보기"
                className="aspect-4/3 w-full rounded-xl object-cover md:aspect-video"
              />
            ) : (
              <div className="flex aspect-4/3 w-full items-center justify-center rounded-xl bg-white/70 text-sm text-neutral-400 md:aspect-video">
                아직 등록된 사진이 없어요
              </div>
            )}

            <div className="flex w-full gap-2">
              <button onClick={() => fileInputRef.current?.click()} className={btnOutline}>
                갤러리에서 선택
              </button>
              <button onClick={() => cameraInputRef.current?.click()} className={btnOutline}>
                촬영하기
              </button>
            </div>

            <div className="flex w-full">
              <button
                onClick={handleUseDemoPhoto}
                disabled={loadingDemoPhoto}
                className={btnOutline}
              >
                {loadingDemoPhoto ? "불러오는 중..." : "예시 사진 불러오기"}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
              className="hidden"
            />

            <button
              onClick={handleRecognize}
              disabled={recognizeStatus === "loading"}
              className={btnPrimary}
            >
              {recognizeStatus === "loading"
                ? "사진에서 품목과 유통기한을 읽는 중..."
                : "AI로 확인하기"}
            </button>

            <div className="w-full">
              <label className="mb-1.5 block text-xs font-bold text-neutral-400">데모 모드</label>
              <select
                value={demoSample}
                onChange={(e) => setDemoSample(e.target.value)}
                className={field}
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
              <p className="text-center text-[13px] text-danger-fg">{registerError}</p>
            )}
          </div>

          {recognizeStatus === "done" && verdict && (
            <div className={card}>
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold tracking-[-0.02em]">AI 인식 결과</h2>
                <span className={toneBadge(verdict.tone)}>{TONE_LABEL[verdict.tone]}</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={label}>품목명</label>
                <input value={itemName} onChange={(e) => setItemName(e.target.value)} className={field} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={label}>카테고리</label>
                <select value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
                  <option value="" disabled>
                    카테고리를 선택하세요
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={label}>유통기한</label>
                <input
                  type="date"
                  value={expiryDate ?? ""}
                  disabled={expiryDate === null}
                  onChange={(e) => setExpiryDate(e.target.value || null)}
                  className={`${field} disabled:bg-neutral-50 disabled:text-neutral-400`}
                />
                <label className="flex items-center gap-2 text-[13px] text-neutral-500">
                  <input
                    type="checkbox"
                    checked={expiryDate === null}
                    onChange={(e) => setExpiryDate(e.target.checked ? null : "")}
                    className="size-4 accent-primary-700"
                  />
                  유통기한이 없는 품목이에요
                </label>
              </div>

              <p className={`text-[13px] font-bold ${TONE_TEXT[verdict.tone]}`}>{verdict.reason}</p>
              {confidence !== null && (
                <p className="text-xs text-neutral-400">
                  AI 신뢰도 {Math.round(confidence * 100)}%
                  {source === "demo" && " · 데모 모드로 지정한 결과예요"}
                </p>
              )}
              {source === "mock" && (
                <p className="text-xs text-warning-fg">
                  AI 서버에 연결하지 못해 예시 데이터로 채웠어요. 내용이 맞는지 직접 확인해주세요
                </p>
              )}

              {!verdict.shareable && (
                <button onClick={handleRestart} className={`${btnDanger} h-12 w-full`}>
                  다른 물품 등록하기
                </button>
              )}
            </div>
          )}

          <button
            disabled={!canGoNext || submittingDonation}
            onClick={handleRegisterNext}
            className={btnSecondary}
          >
            {submittingDonation ? "등록 중..." : "다음: 매칭 결과 확인"}
          </button>
        </div>
      )}

      {step === "match" && donation && (
        <div className="flex flex-col gap-5">
          <header className="text-center">
            <h1 className={pageTitle}>어디에 나눔할까요?</h1>
            <p className={pageDesc}>이 물건이 가장 필요한 곳 순으로 정렬했어요</p>
          </header>

          <div className={`${card} mx-auto w-full max-w-lg`}>
            <div className="flex flex-col gap-1.5">
              <label className={label}>품목명 (다르면 수정하세요)</label>
              <input
                value={donation.itemName}
                onChange={(e) => setDonation({ ...donation, itemName: e.target.value })}
                onBlur={(e) => patchDonation({ itemName: e.target.value })}
                className={field}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={label}>카테고리</label>
              <select
                value={donation.category}
                onChange={(e) => patchDonation({ category: e.target.value })}
                className={field}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={label}>내 지역</label>
              <select
                value={donation.region}
                onChange={(e) => patchDonation({ region: e.target.value })}
                className={field}
              >
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {matchLoading && <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>}

          {!matchLoading && matches.length > 0 && !matches[0].exactMatch && (
            <p className="mx-auto w-full max-w-lg rounded-xl border border-warning-fg/20 bg-warning-bg px-4 py-3 text-[13px] leading-relaxed text-warning-fg">
              {donation.category}를 정확히 요청한 기관이 없어요. 대신 지금 다른 물품을 기다리는 곳을
              보여드릴게요
            </p>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {matches.map((need) => (
              <article key={need.id} className={need.rank === 1 ? cardHighlight : card}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {need.rank === 1 && <span className={rankBadge}>1순위</span>}
                  {need.urgent && <span className={toneBadge("blocked")}>긴급</span>}
                </div>
                <div>
                  <h2 className="text-[20px] font-bold tracking-[-0.02em]">{need.itemName}</h2>
                  <p className="mt-0.5 text-[13px] text-neutral-500">
                    {need.foodBank.name} · {need.distanceKm}km
                  </p>
                  <p className="text-[13px] text-neutral-400">
                    운영일: {need.foodBank.operatingDays.join(", ")}
                  </p>
                </div>

                <NeedProgress
                  filledQty={need.filledQty}
                  targetQty={need.targetQty}
                  progress={need.progress}
                  pendingQty={need.pendingQty}
                />

                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-500">필요도</span>
                  <span className={NEED_TEXT[need.needLabel]}>
                    {need.needScore} · {need.needLabel}
                  </span>
                </div>
                <p className="text-[14px] text-neutral-900">{need.needReason}</p>
                {need.note && <p className={caption}>{need.note}</p>}

                <button onClick={() => handleSelectNeed(need)} className={`${btnPrimary} mt-auto`}>
                  여기에 나눔하기
                </button>
              </article>
            ))}
          </div>

          <button onClick={() => setStep("register")} className={`${btnGhost} mx-auto`}>
            ← 물품 등록으로 돌아가기
          </button>
        </div>
      )}

      {step === "apply" && selectedNeed && (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <header className="text-center">
            <h1 className={pageTitle}>나눔 신청</h1>
            <p className={pageDesc}>
              {selectedNeed.foodBank.name}의 {selectedNeed.itemName} 목표를 채워요
            </p>
          </header>

          <div className={card}>
            <NeedProgress
              filledQty={selectedNeed.filledQty}
              targetQty={selectedNeed.targetQty}
              progress={selectedNeed.progress}
              pendingQty={selectedNeed.pendingQty}
            />

            <div className="flex flex-col gap-1.5">
              <label className={label}>수량</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className={field}
              />
              <p className="text-xs text-neutral-500">
                {quantity}개를 기부하면 진행률이{" "}
                <strong className="text-primary-700">
                  {Math.min(
                    100,
                    Math.round(((selectedNeed.filledQty + quantity) / selectedNeed.targetQty) * 100)
                  )}
                  %
                </strong>
                가 돼요
                {selectedNeed.remainingQty > 0 && ` · 남은 목표 ${selectedNeed.remainingQty}개`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>전달 장소</label>
              <select
                value={placePreset}
                onChange={(e) => setPlacePreset(e.target.value)}
                className={field}
              >
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
                  className={field}
                />
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>내가 가능한 요일</label>
              <div className="flex gap-1">
                {DAY_NAMES.map((day) => (
                  <button
                    key={day}
                    onClick={() => toggleDonorDay(day)}
                    className={chip(donorDays.includes(day))}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <p className="text-xs text-neutral-400">
                {donorDays.length === 0
                  ? "선택 안 하면 아무 요일이나 가능한 걸로 봐요"
                  : `${donorDays.join(", ")}요일`}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={label}>내가 가능한 시간대</label>
              <select
                value={donorSlot}
                onChange={(e) => {
                  setDonorSlot(e.target.value);
                  setDateOptions([]);
                  setSlotMessage(null);
                }}
                className={field}
              >
                {SLOT_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-400">
                {selectedNeed.foodBank.name} 수거 시간: {selectedNeed.foodBank.pickupSlots.join(", ")}
              </p>
            </div>

            <button onClick={handleRecommendDates} disabled={loadingSlots} className={btnSecondary}>
              {loadingSlots ? "가능한 날짜를 찾는 중..." : "AI 추천 날짜 받기"}
            </button>

            {slotMessage && (
              <p
                className={`text-[13px] font-semibold ${
                  dateOptions.length > 0 ? "text-success-fg" : "text-warning-fg"
                }`}
              >
                {slotMessage}
              </p>
            )}

            {dateOptions.map((option) => (
              <button
                key={option.date}
                onClick={() => handlePickDate(option)}
                className={
                  "cursor-pointer rounded-xl px-4 py-3 text-left transition-colors " +
                  (preferredDate === option.date
                    ? "border-2 border-primary-500 bg-primary-50"
                    : "border border-neutral-200 bg-white hover:border-neutral-300")
                }
              >
                <p className="text-[15px] font-bold">
                  {formatKoreanDate(option.date)} ({option.day}) · {option.slot}
                </p>
                <p className="mt-0.5 text-xs text-neutral-400">{option.reason}</p>
              </button>
            ))}

            <div className="flex flex-col gap-1.5">
              <label className={label}>연락처</label>
              <input
                type="tel"
                placeholder="010-0000-0000"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className={field}
              />
            </div>

            {applyError && <p className="text-[13px] text-danger-fg">{applyError}</p>}

            <button onClick={handleApplySubmit} disabled={submittingApplication} className={btnPrimary}>
              {submittingApplication ? "신청 중..." : "나눔 신청하기"}
            </button>
          </div>

          <button onClick={() => setStep("match")} className={`${btnGhost} mx-auto`}>
            ← 매칭 결과로 돌아가기
          </button>
        </div>
      )}

      {step === "complete" && application && (
        <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
          <header className="text-center">
            <h1 className={pageTitle}>신청 완료</h1>
            <p className={pageDesc}>기관의 확인을 기다리고 있어요</p>
          </header>

          <div className={card}>
            <div className="flex items-center justify-between">
              <span className={`text-[13px] font-bold ${STATUS_TEXT[application.status]}`}>
                ● {STATUS_LABEL[application.status]}
              </span>
              <button
                onClick={handleRefreshStatus}
                disabled={refreshingStatus}
                className="cursor-pointer border-none bg-transparent text-xs font-bold text-primary-700 hover:text-primary-800"
              >
                {refreshingStatus ? "확인 중..." : "상태 새로고침"}
              </button>
            </div>

            <div>
              <p className={label}>나눔 품목</p>
              <p className="mt-1 text-[15px]">
                {application.donation.itemName} ({application.donation.category})
              </p>
              {application.donation.expiryDate && (
                <p className="text-[13px] text-neutral-500">
                  유통기한 {application.donation.expiryDate}
                </p>
              )}
            </div>

            <div>
              <p className={label}>기관 · 채우는 목표</p>
              <p className="mt-1 text-[15px]">
                {application.foodBank.name} · {application.need?.itemName}
              </p>
            </div>

            {application.need && (
              <NeedProgress
                filledQty={application.need.filledQty}
                targetQty={application.need.targetQty}
                progress={application.need.progress}
                pendingQty={application.need.pendingQty}
              />
            )}

            <div>
              <p className={label}>수량 / 전달</p>
              <p className="mt-1 text-[15px]">
                {application.quantity}개 · {formatKoreanDate(application.preferredDate)}
                {application.preferredSlot && ` ${application.preferredSlot}`}
              </p>
              <p className="text-[13px] text-neutral-500">{application.place}</p>
            </div>

            <div>
              <p className={label}>기부금 신청서 작성 여부</p>
              <p
                className={`mt-1 text-[15px] font-semibold ${
                  application.receiptRequested ? "text-success-fg" : "text-neutral-400"
                }`}
              >
                {application.receiptRequested ? "작성 완료" : "미작성"}
              </p>
            </div>

            {application.status === "accepted" && !application.receiptRequested && (
              <button onClick={handleReceiptRequest} disabled={requestingReceipt} className={btnPrimary}>
                {requestingReceipt ? "요청 중..." : "기부금 영수증 요청"}
              </button>
            )}
          </div>

          <button onClick={handleRestart} className={btnSecondary}>
            처음부터 다시 신청하기
          </button>
        </div>
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
