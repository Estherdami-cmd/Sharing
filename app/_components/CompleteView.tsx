"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKoreanDate, isSameItem } from "@/lib/rules";
import type { ApplicationDetail } from "@/lib/store";
import NeedProgress from "./NeedProgress";
import { btnGhost, btnPrimary, btnSecondary, card, label, pageDesc, pageTitle } from "../ui";

type LoadState = "loading" | "ready" | "notfound";

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

/** 다시 들어와서 보는 페이지라 부제도 상태를 따라가야 한다.
 * 수락된 뒤에도 "기다리고 있어요"라고 하면 화면이 거짓말을 한다. */
const STATUS_DESC: Record<ApplicationDetail["status"], string> = {
  pending: "기관의 확인을 기다리고 있어요",
  accepted: "기관이 수락했어요. 약속한 날짜에 전달해주세요",
  rejected: "이번에는 전달이 어렵게 됐어요",
};

/**
 * 신청 완료 화면. /apply의 한 단계가 아니라 /complete/[id]라는 독립 페이지다.
 * 주소를 갖는 덕에 새로고침해도 유지되고, 나중에 다시 들어와 상태를 확인할 수 있다.
 */
export default function CompleteView({ applicationId }: { applicationId: string }) {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [requestingReceipt, setRequestingReceipt] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/applications/${applicationId}`);
      if (cancelled) return;
      if (!res.ok) {
        setLoadState("notfound");
        return;
      }
      setApplication(await res.json());
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

  async function handleRefreshStatus() {
    setRefreshingStatus(true);
    const res = await fetch(`/api/applications/${applicationId}`);
    if (res.ok) setApplication(await res.json());
    setRefreshingStatus(false);
  }

  async function handleReceiptRequest() {
    setRequestingReceipt(true);
    await fetch(`/api/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiptRequested: true }),
    });
    const res = await fetch(`/api/applications/${applicationId}`);
    if (res.ok) setApplication(await res.json());
    setRequestingReceipt(false);
  }

  if (loadState === "loading") {
    return <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>;
  }

  // 저장소가 서버 메모리에 있어서 서버가 재시작되면 신청 id가 사라진다.
  // 저장해둔 주소로 들어왔을 때 빈 화면을 보여주지 않고 사유를 말한다.
  if (loadState === "notfound" || !application) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className={pageTitle}>신청 내역을 찾을 수 없어요</h1>
        <p className="text-[15px] leading-relaxed text-neutral-500">
          데모 서버가 초기화되면서 신청 기록이 사라졌어요.
          <br />
          아래에서 다시 시작해주세요.
        </p>
        <div className="mt-2 flex w-full max-w-xs flex-col gap-3">
          <Link href="/board" className={btnSecondary}>
            지금 필요한 것들 보기
          </Link>
          <Link href="/donate" className={`${btnGhost} mx-auto`}>
            새 물품 등록하기
          </Link>
        </div>
      </div>
    );
  }

  const need = application.need;
  // 카테고리가 요청과 다르면 수락돼도 진행률에 반영되지 않는다 — 그런 경우엔
  // 미리보기 숫자를 보여주지 않는다(실제로 그 값이 되지 않으니까).
  const categoryMatches = need ? application.donation.category === need.category : false;
  // 신청은 아직 pending이라 filledQty가 안 움직였다. 내 몫이 반영되면 어떻게 되는지 미리 보여준다.
  const projected =
    need && categoryMatches
      ? Math.min(100, Math.round(((need.filledQty + application.quantity) / need.targetQty) * 100))
      : null;
  // 분류는 같은데 물건이 다른 경우. 기관이 판단하는 중이라는 사실만 담담히 알린다 —
  // "받을 수 있는지 확인 중"처럼 쓰면 이미 신청을 마친 사람을 불안하게 만든다.
  const sameItem = need ? isSameItem(application.donation.itemName, need.itemName) : true;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>신청 완료</h1>
        <p className={pageDesc}>{STATUS_DESC[application.status]}</p>
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
            {application.foodBank.name} · {need?.itemName}
          </p>
        </div>

        {need && (
          <>
            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
            />
            {application.status === "pending" && projected !== null && (
              <p className="text-xs text-neutral-500">
                회원님의 {application.quantity}개가 수락되면 진행률이{" "}
                <strong className="text-primary-700">{projected}%</strong>가 돼요
              </p>
            )}
            {application.status === "pending" && !categoryMatches && (
              <p className="text-xs text-neutral-500">
                이 요청 수치에는 안 들어가지만, 기관에 직접 전달돼요
              </p>
            )}
            {application.status === "pending" && categoryMatches && !sameItem && (
              <p className="text-xs text-neutral-500">
                &apos;{need.itemName}&apos; 요청이라, 기관이 확인하고 있어요
              </p>
            )}
          </>
        )}

        <div>
          <p className={label}>수량 / 전달</p>
          <p className="mt-1 text-[15px]">{application.quantity}개</p>
          {application.confirmedDate ? (
            <p className="mt-1 text-[15px] font-semibold text-success-fg">
              확정된 날짜: {formatKoreanDate(application.confirmedDate)}
              {application.confirmedSlot && ` ${application.confirmedSlot}`}
            </p>
          ) : (
            <div className="mt-1">
              <p className="text-[13px] text-neutral-500">
                제안한 날짜 후보 (기관이 확인 중이에요)
              </p>
              <ul className="mt-0.5 flex flex-col gap-0.5 text-[14px]">
                {application.candidateDates.map((c) => (
                  <li key={`${c.date}-${c.slot}`}>
                    {formatKoreanDate(c.date)} {c.slot}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-1 text-[13px] text-neutral-500">{application.place}</p>
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

      {/* 로그인이 없으므로 이 주소가 유일한 재방문 수단이다. 숨기지 말고 알려준다. */}
      <p className="text-center text-xs leading-relaxed text-neutral-400">
        이 페이지 주소를 저장해두면 나중에 진행 상태를 다시 확인할 수 있어요
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/board" className={btnSecondary}>
          다른 요청도 채워보기
        </Link>
        <Link href="/donate" className={`${btnGhost} mx-auto`}>
          새 물품 등록하기
        </Link>
      </div>
    </div>
  );
}
