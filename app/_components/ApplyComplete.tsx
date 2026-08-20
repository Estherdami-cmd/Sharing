"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { formatKoreanDate } from "@/lib/rules";
import type { ApplicationDetail } from "@/lib/store";
import { btnPrimary, btnSecondary, card, label, pageDesc, pageTitle } from "../ui";
import NeedProgress from "./NeedProgress";

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

/**
 * 4단계: 신청 완료.
 * 3단계에서 넘어온 applicationId로 신청 상세를 서버에서 불러온다.
 * 상태는 기관이 바꾸므로 이 화면은 계속 새로 읽어야 한다. 그래서 별도 주소인 게 오히려 맞다.
 */
export default function ApplyComplete() {
  const searchParams = useSearchParams();
  const applicationId = searchParams.get("applicationId");

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [requestingReceipt, setRequestingReceipt] = useState(false);

  useEffect(() => {
    if (!applicationId) {
      setLoadState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/applications/${applicationId}`);
      if (!res.ok) {
        if (!cancelled) setLoadState("error");
        return;
      }
      const detail = await res.json();
      if (cancelled) return;
      setApplication(detail);
      setLoadState("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId]);

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

  if (loadState === "error" || !application) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <p className="text-[15px] text-neutral-500">
          신청 정보를 찾을 수 없어요. 물품 등록부터 다시 시작해주세요
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
  );
}
