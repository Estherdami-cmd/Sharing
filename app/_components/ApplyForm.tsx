"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DAY_NAMES, formatKoreanDate, isSameItem, isValidPhone } from "@/lib/rules";
import type { DateOption, Donation, NeedView } from "@/lib/store";
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
  const [selectedNeed, setSelectedNeed] = useState<NeedView | null>(null);

  const [donorDays, setDonorDays] = useState<string[]>([]);
  const [donorSlot, setDonorSlot] = useState("상관없음");
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [slotMessage, setSlotMessage] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  // 고른 날짜 후보를 전부 기관에 제안으로 보낸다. 기관이 이 중 하나를 골라 확정한다.
  const [selectedOptions, setSelectedOptions] = useState<DateOption[]>([]);
  const [contact, setContact] = useState("");
  // 입력하는 동안 빨간 글씨를 띄우면 다 적기도 전에 틀렸다고 하는 꼴이라,
  // 입력란을 벗어난 뒤부터 형식을 지적한다.
  const [contactTouched, setContactTouched] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [submittingApplication, setSubmittingApplication] = useState(false);

  const place = selectedNeed?.foodBank.name ?? "";

  // 제출 조건. 전달 장소는 매칭된 기관명이 자동으로 들어가므로 검사 대상이 아니다.
  const canSubmit = selectedOptions.length > 0 && isValidPhone(contact);

  /*
    수량은 등록 화면(/donate)에서 적은 값이 매칭 화면을 거쳐 주소로 실려 온다.
    주소는 사용자가 직접 고칠 수 있으니 그대로 믿지 않고 여기서 다시 다듬는다.
    남은 목표가 있으면 그 값으로 잠근다 — 목표보다 많이 내겠다는 신청은 만들지 않는다.
  */
  const parsedQuantity = Math.floor(Number(quantityParam));
  const requestedQuantity = Number.isFinite(parsedQuantity) ? Math.max(1, parsedQuantity) : 1;
  // 목표가 남아있으면 그만큼으로, 이미 다 찼으면(여유분 받기) 목표 수량만큼으로
  // 상한을 둔다 — 주소창에 quantity=9999처럼 직접 써넣어도 그대로 통과하던 버그가 있었다.
  const quantity = selectedNeed
    ? Math.min(
        requestedQuantity,
        selectedNeed.remainingQty > 0 ? selectedNeed.remainingQty : selectedNeed.targetQty
      )
    : requestedQuantity;

  // 별도 주소라 새로고침·직접 접속에도 대응해야 하므로 앞 단계의 state에 의존하지 않는다.
  //
  // /api/match/:donationId는 안 쓴다 — matchNeeds()가 등록한 사진의 카테고리와 정확히
  // 맞는 요청이 하나라도 있으면 다른 카테고리는 통째로 목록에서 뺀다. 게시판에서 특정
  // need를 보고 바로 들어온 경우(등록한 사진 카테고리가 그 need와 다를 수 있음) 그 필터링
  // 때문에 여기서 못 찾을 수 있다. 이 화면은 애초에 needScore/needLabel 같은 매칭 전용
  // 필드를 쓰지 않으니, 필터링 없는 /api/donations·/api/needs에서 직접 찾는다.
  useEffect(() => {
    if (!donationId || !needId) {
      setLoadState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      const [donationRes, needsRes] = await Promise.all([
        fetch(`/api/donations/${donationId}`),
        fetch("/api/needs"),
      ]);
      if (!donationRes.ok || !needsRes.ok) {
        if (!cancelled) setLoadState("error");
        return;
      }
      const donationData = await donationRes.json();
      const needsData = await needsRes.json();
      const need = (needsData.needs as NeedView[]).find((n) => n.id === needId);
      if (!need) {
        if (!cancelled) setLoadState("error");
        return;
      }
      if (cancelled) return;
      setDonation(donationData);
      setSelectedNeed(need);
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
    setSelectedOptions([]);
  }

  const foodBankId = selectedNeed?.foodBank.id;
  const expiryDate = donation?.expiryDate;

  const loadDateOptions = useCallback(async () => {
    if (!foodBankId) return;
    setLoadingSlots(true);
    setSlotMessage(null);

    const query = new URLSearchParams({ days: donorDays.join(","), slot: donorSlot });
    if (expiryDate) query.set("maxDate", expiryDate);

    try {
      const res = await fetch(`/api/slots/${foodBankId}?${query}`);
      if (!res.ok) {
        // 조용히 끝내면 로딩만 멈추고 화면이 그대로라, 버튼이 고장난 것처럼 보인다.
        setDateOptions([]);
        setSlotMessage("가능한 날짜를 불러오지 못했어요. 잠시 후 다시 시도해주세요");
        return;
      }
      const data = await res.json();
      setDateOptions(data.options);
      setSlotMessage(data.message);
      setSelectedOptions([]);
    } catch {
      setDateOptions([]);
      setSlotMessage("연결에 문제가 있어요. 잠시 후 다시 시도해주세요");
    } finally {
      setLoadingSlots(false);
    }
  }, [foodBankId, donorDays, donorSlot, expiryDate]);

  // 요일 미선택·시간대 "상관없음"이 이미 유효한 기본값이다. 버튼을 눌러야만 목록이
  // 뜨면, 안 누른 사용자는 "날짜를 고르라"는 오류만 보고 고를 목록은 못 본다.
  // 화면이 준비되는 즉시 기본 조건으로 한 번 불러온다. 이후 조건 변경은 버튼으로 한다.
  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    if (loadState !== "ready" || autoLoaded) return;
    setAutoLoaded(true);
    loadDateOptions();
  }, [loadState, autoLoaded, loadDateOptions]);

  /**
   * 여러 날짜를 골라서 전부 기관에 제안으로 보낸다 — 다시 누르면 선택 해제.
   * 기관이 이 중 하나를 골라 확정하는 방식이라, 여기서 "최종 하나"를 미리 정하지 않는다.
   */
  function handlePickDate(option: DateOption) {
    setSelectedOptions((prev) =>
      prev.some((o) => o.date === option.date)
        ? prev.filter((o) => o.date !== option.date)
        : [...prev, option]
    );
    setApplyError(null);
  }

  async function handleApplySubmit() {
    setApplyError(null);
    if (!donation || !selectedNeed) {
      setApplyError("매칭된 기관 정보가 없어요. 이전 단계로 돌아가주세요");
      return;
    }
    if (selectedOptions.length === 0) {
      setApplyError("추천 날짜 중 하나 이상 선택해주세요");
      return;
    }
    if (!isValidPhone(contact)) {
      setContactTouched(true);
      setApplyError("연락처를 다시 확인해주세요 (010으로 시작하는 10~11자리)");
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
        candidateDates: selectedOptions.map((o) => ({ date: o.date, slot: o.slot })),
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

        {/*
          내가 낼 물품명이 화면에 없어서, 요청 품목만 보고 "즉석밥을 내는구나"로
          읽히던 자리다. 무엇을 내는지 먼저 보여주고, 요청과 다르면 그 사실을 말한다.
        */}
        <div className="flex flex-col gap-1.5">
          <label className={label}>나눔할 물품</label>
          <p className="flex h-12 w-full items-center rounded-xl border border-neutral-200 bg-neutral-50 px-4 text-[15px] text-neutral-700">
            {donation?.itemName}
            {donation?.category && ` (${donation.category})`}
          </p>
          {donation && donation.category !== selectedNeed.category ? (
            <p className="text-xs text-neutral-500">
              이 요청 수치에는 안 들어가지만, 기관에 직접 전달돼요
            </p>
          ) : donation && !isSameItem(donation.itemName, selectedNeed.itemName) ? (
            <p className="text-xs text-neutral-500">
              &apos;{selectedNeed.itemName}&apos; 요청이지만, 기관에서 확인하고 받아요
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={label}>수량</label>
          <p className={`${field} flex items-center bg-neutral-100 text-neutral-700`}>
            {quantity}개
          </p>
          {/*
            남은 목표 때문에 줄어든 경우엔 그 사실을 먼저 말한다. 등록 화면에서 적은
            숫자와 다른 값이 아무 설명 없이 떠 있으면 잘못 반영된 것처럼 보인다.
          */}
          {quantity < requestedQuantity ? (
            <p className="text-xs text-warning-fg">
              등록 화면에서는 {requestedQuantity}개로 적으셨지만, 이 요청에 남은 목표가{" "}
              {quantity}개라 {quantity}개로 맞췄어요
            </p>
          ) : (
            <p className="text-xs text-neutral-400">
              수량은 매칭 화면에서 정한 값이에요. 바꾸려면 아래 &apos;매칭 결과로 돌아가기&apos;를
              눌러주세요
            </p>
          )}
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
              setSelectedOptions([]);
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

        {/* 자동으로 한 번 불러온 뒤에는 이 버튼의 역할이 '조건을 바꿔 다시 찾기'로 바뀐다. */}
        <button onClick={loadDateOptions} disabled={loadingSlots} className={btnSecondary}>
          {loadingSlots
            ? "가능한 날짜를 찾는 중..."
            : autoLoaded
              ? "조건 바꿔서 다시 찾기"
              : "AI 추천 날짜 받기"}
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

        {dateOptions.length > 0 && (
          <p className="text-xs text-neutral-400">
            가능한 날짜를 여러 개 골라서 제안해보세요. 기관이 그중 하나를 골라 확정해줘요
            {/* 목록이 길면 몇 개 골랐는지 잊는다. 기관에 무엇을 보내는지가 이 화면의 결과물이다. */}
            {selectedOptions.length > 0 && (
              <strong className="ml-1 text-primary-700">· {selectedOptions.length}개 선택됨</strong>
            )}
          </p>
        )}

        {dateOptions.map((option) => {
          const isSelected = selectedOptions.some((o) => o.date === option.date);
          return (
            <button
              key={option.date}
              onClick={() => handlePickDate(option)}
              className={
                "cursor-pointer rounded-xl px-4 py-3 text-left transition-colors " +
                (isSelected
                  ? "border-2 border-primary-500 bg-primary-50"
                  : "border border-neutral-200 bg-white hover:border-neutral-300")
              }
            >
              <p className="text-[15px] font-bold">
                {formatKoreanDate(option.date)} ({option.day}) · {option.slot}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">{option.reason}</p>
            </button>
          );
        })}

        <div className="flex flex-col gap-1.5">
          <label className={label}>연락처</label>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="01000000000"
            value={contact}
            onChange={(e) => {
              setContact(e.target.value.replace(/\D/g, ""));
              setApplyError(null);
            }}
            onBlur={() => setContactTouched(true)}
            className={field}
          />
          {contactTouched && contact && !isValidPhone(contact) ? (
            <p className="text-xs text-danger-fg">010으로 시작하는 10~11자리로 적어주세요</p>
          ) : (
            <p className="text-xs text-neutral-400">
              기관이 전달 일정을 확인할 때 이 번호로 연락해요
            </p>
          )}
        </div>

        {applyError && <p className="text-[13px] text-danger-fg">{applyError}</p>}

        {/* 눌러본 뒤에 틀렸다고 하지 않는다 — 조건이 안 맞으면 아예 못 누르게 한다
            (DESIGN_GUIDE 1.1 "실패를 미리 막는다", RegisterFlow의 canGoNext와 같은 방식). */}
        <button
          onClick={handleApplySubmit}
          disabled={!canSubmit || submittingApplication}
          className={btnPrimary}
        >
          {submittingApplication
            ? "신청 중..."
            : selectedOptions.length > 0
              ? `${selectedOptions.length}개 날짜로 신청하기`
              : "나눔 신청하기"}
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
