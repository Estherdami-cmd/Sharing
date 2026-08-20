"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DAY_NAMES, formatKoreanDate } from "@/lib/rules";
import type { DateOption, Donation, NeedMatch } from "@/lib/store";
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

type MatchResult = NeedMatch;

const SLOT_CHOICES = ["상관없음", "오전", "오후"];

/**
 * 3단계: 나눔 신청.
 * 2단계에서 넘어온 donationId·needId로 매칭 정보를 다시 불러온다.
 * 신청에 성공하면 만들어진 신청 id를 쿼리에 실어 4단계 주소로 넘긴다.
 */
export default function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const donationId = searchParams.get("donationId");
  const needId = searchParams.get("needId");
  const quantityParam = searchParams.get("quantity");

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [donation, setDonation] = useState<Donation | null>(null);
  const [selectedNeed, setSelectedNeed] = useState<MatchResult | null>(null);

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

  const place = selectedNeed?.foodBank.name ?? "";

  /*
    수량은 매칭 화면(/match/[id])에서 고른 값이 주소로 실려 온다.
    주소는 사용자가 직접 고칠 수 있으니 그대로 믿지 않고 여기서 다시 다듬는다.
    남은 목표가 있으면 그 값으로 잠근다 — 목표보다 많이 내겠다는 신청은 만들지 않는다.
  */
  const parsedQuantity = Math.floor(Number(quantityParam));
  const requestedQuantity = Number.isFinite(parsedQuantity) ? Math.max(1, parsedQuantity) : 1;
  const quantity =
    selectedNeed && selectedNeed.remainingQty > 0
      ? Math.min(requestedQuantity, selectedNeed.remainingQty)
      : requestedQuantity;

  // 별도 주소라 새로고침·직접 접속에도 대응해야 하므로 앞 단계의 state에 의존하지 않는다.
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
    // 완료 화면은 신청 id를 주소에 담는 독립 페이지다.
    router.push(`/complete/${created.id}`);
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
          <p className={`${field} flex items-center bg-neutral-100 text-neutral-700`}>
            {quantity}개
          </p>
          <p className="text-xs text-neutral-400">
            수량은 앞 화면에서 고른 값이에요. 바꾸려면 매칭 결과로 돌아가주세요
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={label}>전달 장소</label>
          <p className="flex h-12 w-full items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-700">
            {selectedNeed.foodBank.name}
          </p>
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

      <Link
        href={donationId ? `/match/${donationId}` : "/donate"}
        className={`${btnGhost} mx-auto`}
      >
        ← 매칭 결과로 돌아가기
      </Link>
    </div>
  );
}
