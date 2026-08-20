"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DAY_NAMES } from "@/lib/rules";
import type { ApplicationDetail, DateOption, Donation, NeedMatch } from "@/lib/store";
import StepIndicator from "./StepIndicator";
import {
  btnGhost,
  btnPrimary,
  btnSecondary,
  card,
  chip,
  field,
  label,
  pageDesc,
  pageTitle,
} from "../ui";
import NeedProgress from "./NeedProgress";

type Step = "apply" | "complete";
type MatchResult = NeedMatch;

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

const PLACE_PRESETS = ["기관에 직접 전달", "집 앞 수거", "직접 입력"];
const SLOT_CHOICES = ["상관없음", "오전", "오후"];

export default function ApplyFlow() {
  const searchParams = useSearchParams();
  const donationId = searchParams.get("donationId");
  const needId = searchParams.get("needId");

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [donation, setDonation] = useState<Donation | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<MatchResult | null>(null);

  const [step, setStep] = useState<Step>("apply");

  // 3. 기부 신청
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

  const place = placePreset === "직접 입력" ? placeDetail : placePreset;

  // 물품 등록 페이지(/donate)에서 넘어온 donationId·needId로 매칭 정보를 다시 불러온다.
  // 별도 주소라 새로고침·직접 접속에도 대응해야 하므로 로컬 state로만 들고 있지 않는다.
  useEffect(() => {
    if (!donationId || !needId) {
      setLoadState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/match/${donationId}`);
      if (!res.ok) {
        if (!cancelled) setLoadState("error");
        return;
      }
      const data = await res.json();
      const match = (data.matches as MatchResult[]).find((m) => m.id === needId);
      if (!match) {
        if (!cancelled) setLoadState("error");
        return;
      }
      if (cancelled) return;
      setDonation(data.donation);
      setSelectedNeed(match);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [donationId, needId]);

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

  if (loadState === "loading") {
    return <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>;
  }

  if (loadState === "error" || !selectedNeed) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-[15px] text-neutral-500">
          매칭 정보를 찾을 수 없어요. 물품 등록부터 다시 시작해주세요
        </p>
        <Link href="/donate" className={btnSecondary}>
          물품 등록하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator step={step} />

      {step === "apply" && (
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
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="01000000000"
                value={contact}
                onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))}
                className={field}
              />
            </div>

            {applyError && <p className="text-[13px] text-danger-fg">{applyError}</p>}

            <button onClick={handleApplySubmit} disabled={submittingApplication} className={btnPrimary}>
              {submittingApplication ? "신청 중..." : "나눔 신청하기"}
            </button>
          </div>

          <Link href="/donate" className={`${btnGhost} mx-auto`}>
            ← 물품 등록으로 돌아가기
          </Link>
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

          <Link href="/donate" className={btnSecondary}>
            처음부터 다시 신청하기
          </Link>
        </div>
      )}
    </div>
  );
}

function formatKoreanDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}
