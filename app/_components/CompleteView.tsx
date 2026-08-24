"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ApplicationDetail } from "@/lib/store";
import NeedProgress from "./NeedProgress";
import { btnGhost, btnPrimary, btnSecondary, caption, card, label, pageDesc, pageTitle } from "../ui";

/** 신청 내역을 못 찾은 것("없는 id")과 못 불러온 것("연결 실패")은 사용자가 할 행동이 다르다.
 * 앞은 다시 시작해야 하고, 뒤는 그냥 다시 시도하면 된다. 그래서 따로 둔다. */
type LoadState = "loading" | "ready" | "notfound" | "error";

/** 상태를 바꾸는 건 기관이라 이 화면은 가만히 있어도 낡는다.
 * 사용자가 버튼을 눌러 알아내야 할 이유가 없어 pending 동안만 짧게 물어본다. */
const POLL_INTERVAL_MS = 5000;

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
  const [receiptError, setReceiptError] = useState<string | null>(null);
  // 연결 실패 화면의 '다시 시도'가 아래 최초 로드 effect를 한 번 더 돌리는 손잡이.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    (async () => {
      try {
        const res = await fetch(`/api/applications/${applicationId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setLoadState("notfound");
          return;
        }
        if (!res.ok) {
          setLoadState("error");
          return;
        }
        const detail = await res.json();
        if (cancelled) return;
        setApplication(detail);
        setLoadState("ready");
      } catch {
        // 네트워크가 끊긴 경우. 감싸지 않으면 "불러오는 중..."에서 영구히 멈춘다.
        if (!cancelled) setLoadState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applicationId, reloadKey]);

  // 기관이 수락/거절하면 화면이 저절로 따라간다. 결론이 난 뒤에는 더 볼 게 없어 멈춘다.
  // application 전체가 아니라 status만 의존성에 두어, 같은 pending이 다시 들어와도
  // 타이머를 새로 만들지 않는다.
  useEffect(() => {
    if (application?.status !== "pending") return;

    let cancelled = false;
    async function check() {
      try {
        const res = await fetch(`/api/applications/${applicationId}`);
        if (!cancelled && res.ok) setApplication(await res.json());
      } catch {
        // 폴링 실패는 조용히 넘긴다. 이미 보이는 정보를 오류로 덮는 게 더 나쁘고,
        // 다음 회차에 다시 시도한다.
      }
    }

    const timer = setInterval(() => {
      if (document.hidden) return; // 안 보는 탭에서까지 물어볼 이유가 없다
      check();
    }, POLL_INTERVAL_MS);

    // 탭으로 돌아온 순간이 곧 결과를 보려는 순간이다. 다음 회차까지 기다리게 하지 않는다.
    // (기관 창과 이 창을 번갈아 보는 게 이 화면의 기본 사용법이다)
    function handleVisibilityChange() {
      if (!document.hidden) check();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applicationId, application?.status]);

  async function handleRefreshStatus() {
    setRefreshingStatus(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}`);
      if (res.ok) setApplication(await res.json());
    } catch {
      // 직접 누른 새로고침이 실패해도 화면은 그대로 두고 버튼만 되살린다.
    }
    setRefreshingStatus(false);
  }

  async function handleReceiptRequest() {
    setRequestingReceipt(true);
    setReceiptError(null);
    try {
      // PATCH가 갱신된 신청 상세를 그대로 돌려주므로 다시 GET하지 않는다.
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptRequested: true }),
      });
      if (res.ok) {
        setApplication(await res.json());
      } else {
        setReceiptError("영수증 요청에 실패했어요. 다시 시도해주세요");
      }
    } catch {
      setReceiptError("연결에 문제가 있어요. 다시 시도해주세요");
    }
    setRequestingReceipt(false);
  }

  if (loadState === "loading") {
    return <p className="text-center text-[15px] text-neutral-500">불러오는 중...</p>;
  }

  // 서버는 살아 있는데 못 불러온 경우. 다시 시작하라고 하면 안 된다 — 신청은 남아 있으니
  // 같은 주소로 한 번 더 시도하면 되고, 그 버튼만 주는 게 맞다.
  if (loadState === "error") {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 py-16 text-center">
        <h1 className={pageTitle}>신청 내역을 불러오지 못했어요</h1>
        <p className="text-[15px] leading-relaxed text-neutral-500">
          연결에 문제가 있어요.
          <br />
          잠시 후 다시 시도해주세요.
        </p>
        <div className="mt-2 w-full max-w-xs">
          <button onClick={() => setReloadKey((n) => n + 1)} className={btnSecondary}>
            다시 시도
          </button>
        </div>
      </div>
    );
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>신청 완료</h1>
        <p className={pageDesc}>{STATUS_DESC[application.status]}</p>
      </header>

      <div className={card}>
        <div className="flex items-center justify-between">
          {/* 폴링으로 저절로 바뀌는 자리라, 색이 튀지 않고 넘어가게 한다. */}
          <span
            className={`text-[13px] font-bold transition-colors duration-200 ${
              STATUS_TEXT[application.status]
            }`}
          >
            ● {STATUS_LABEL[application.status]}
          </span>
          <button
            onClick={handleRefreshStatus}
            disabled={refreshingStatus}
            className="-mr-2 min-h-11 cursor-pointer border-none bg-transparent px-2 text-xs font-bold text-primary-700 hover:text-primary-800"
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
            <p className={caption}>유통기한 {application.donation.expiryDate}</p>
          )}
        </div>

        <div>
          <p className={label}>기관 · 채우는 목표</p>
          <p className="mt-1 text-[15px]">
            {application.foodBank.name} · {need?.itemName}
          </p>
        </div>

        {/* 내 몫이 수락되면 몇 %가 되는지는 NeedProgress가 이미 캡션으로 말한다.
            pendingQty에 내 신청이 포함돼 있어(store.ts toView) 여기서 또 계산하면
            같은 숫자를 두 줄로 말하게 된다. */}
        {need && (
          <NeedProgress
            filledQty={need.filledQty}
            targetQty={need.targetQty}
            progress={need.progress}
            pendingQty={need.pendingQty}
          />
        )}

        {/* place는 매칭된 기관명이 자동으로 들어가므로(ApplyFlow) 위 '기관 · 채우는 목표'와
            같은 문자열이다. 고르는 값이던 시절의 잔재라 따로 보여주지 않는다. */}
        <div>
          <p className={label}>전달 예정</p>
          <p className="mt-1 text-[15px]">
            {formatKoreanDate(application.preferredDate)}
            {application.preferredSlot && ` ${application.preferredSlot}`} · {application.quantity}개
          </p>
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

        {/* 실패를 조용히 넘기면 화면이 계속 "미작성"이라 사용자가 뭘 잘못했는지 모른다.
            토스트 대신 눌린 버튼 자리에서 말한다(DESIGN_GUIDE 5.4). */}
        {receiptError && <p className="text-[13px] text-danger-fg">{receiptError}</p>}

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

function formatKoreanDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}
