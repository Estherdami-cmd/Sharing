"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKoreanDate, isSameItem } from "@/lib/rules";
import type { ApplicationDetail } from "@/lib/store";
import NeedProgress from "./NeedProgress";
import {
  btnGhost,
  btnSecondary,
  caption,
  card,
  label,
  pageDesc,
  pageTitle,
} from "../ui";

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
 * 수락된 뒤에도 "기다리고 있어요"라고 하면 화면이 거짓말을 한다.
 * pending 문구는 기관이 지금 하는 일(날짜 고르기)을 그대로 말한다 — 그냥 "확인 중"이라고 하면
 * 사용자는 무엇을 기다리는지 모른 채 기다리게 된다. */
const STATUS_DESC: Record<ApplicationDetail["status"], string> = {
  pending: "기관이 제안한 날짜 중 하나를 고르고 있어요",
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
  // 카테고리가 요청과 다르면 수락돼도 진행률에 반영되지 않는다 — 그런 경우엔
  // 미리보기 숫자를 보여주지 않는다(실제로 그 값이 되지 않으니까).
  const categoryMatches = need ? application.donation.category === need.category : false;
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
        {/* 저절로 바뀌는 영역이라 aria-live를 준다 — 눈으로 보는 사람에게만 바뀌면
            스크린리더 사용자는 기관이 수락한 걸 끝까지 모른다. */}
        <div aria-live="polite">
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
          {/* 버튼만 있으면 사용자가 직접 눌러야 하는 화면으로 읽힌다. 기다려도 된다고 말해준다. */}
          {application.status === "pending" && (
            <p className={caption}>상태는 자동으로 확인하고 있어요</p>
          )}
        </div>

        {/* 이 화면에 다시 들어오는 이유는 "내 약속이 어떻게 됐지?" 하나다.
            상태에 따라 답이 달라지므로, 그 답 하나만 큰 글씨로 맨 위에 둔다.
            나머지 항목은 아래 표로 밀어 대비를 만든다 — 전부 같은 크기면 아무것도 안 읽힌다. */}
        {application.confirmedDate ? (
          <div className="rounded-xl bg-success-bg px-4 py-3.5">
            <p className={label}>전달 약속</p>
            <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-[-0.03em] text-success-fg">
              {formatKoreanDate(application.confirmedDate)}
              {application.confirmedSlot && ` ${application.confirmedSlot}`}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-neutral-600">
              {application.foodBank.name}
              <br />
              {application.foodBank.address}
            </p>
          </div>
        ) : (
          <div
            className={`rounded-xl px-4 py-3.5 ${
              application.status === "rejected" ? "bg-neutral-50" : "bg-warning-bg"
            }`}
          >
            <p className={label}>제안한 날짜</p>
            <ul className="mt-1 flex flex-col gap-1">
              {application.candidateDates.map((c) => (
                <li
                  key={`${c.date}-${c.slot}`}
                  className="text-[17px] font-bold leading-tight tracking-[-0.02em]"
                >
                  {formatKoreanDate(c.date)} {c.slot}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[13px] text-neutral-600">
              {application.status === "pending"
                ? "기관이 이 중 하나를 골라 확정해요"
                : // 거절된 신청에까지 "확인 중"이라고 하면 화면이 거짓말을 한다.
                  "이번에는 확정되지 않았어요"}
            </p>
          </div>
        )}

        {/* 크라우드펀딩식 서비스라 "내가 얼마나 채우는가"가 이 화면의 두 번째 주인공이다.
            막대에서 내 몫을 색으로 갈라 보여준다(NeedProgress mineQty). */}
        {need && (
          <div className="flex flex-col gap-1.5">
            <p className={label}>이 요청 진행률</p>
            <NeedProgress
              filledQty={need.filledQty}
              targetQty={need.targetQty}
              progress={need.progress}
              pendingQty={need.pendingQty}
              // 거절된 신청은 이 요청에 아무 영향이 없으므로 내 몫을 그리지 않는다.
              mineQty={
                categoryMatches && application.status !== "rejected"
                  ? application.quantity
                  : undefined
              }
              mineCounted={application.status === "accepted"}
            />
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
          </div>
        )}

        {/* 부가 정보는 라벨-값 한 쌍씩 세로로 늘어놓으면 화면만 길어지고 눈이 미끄러진다.
            두 칸으로 접어 한눈에 훑게 한다. place는 매칭 기관명이 자동으로 들어가(ApplyForm)
            위 '받는 곳'과 같은 문자열이라 따로 보여주지 않는다. */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-neutral-100 pt-4">
          <div>
            <p className={label}>나눔 품목</p>
            <p className="mt-1 text-[15px] leading-snug">{application.donation.itemName}</p>
            <p className={caption}>{application.donation.category}</p>
          </div>

          <div>
            <p className={label}>수량</p>
            <p className="mt-1 text-[15px]">{application.quantity}개</p>
            {application.donation.expiryDate && (
              // 화면의 다른 날짜는 전부 "8월 25일"인데 여기만 2027-03-09이면 눈에 걸린다.
              <p className={caption}>~{formatExpiry(application.donation.expiryDate)}</p>
            )}
          </div>

          {/* 확정된 경우엔 위 '전달 약속'이 기관과 주소를 이미 말했다. 두 번 쓰지 않는다. */}
          {!application.confirmedDate && (
            <div className="col-span-2">
              <p className={label}>받는 곳</p>
              <p className="mt-1 text-[15px] leading-snug">
                {application.foodBank.name}
                {need && ` · ${need.itemName}`}
              </p>
              <p className={caption}>{application.foodBank.address}</p>
            </div>
          )}

        </div>
      </div>

      {/* 예전에는 여기서 "이 주소를 저장해두세요"라고 안내하고 복사 버튼까지 뒀는데 뺐다.
          신청 id가 a1·a2처럼 순번이라 주소를 조금만 바꿔도 남의 신청이 열리고, 응답에는
          연락처까지 실려 나간다. 인증이 붙기 전까지 그 주소를 널리 퍼뜨리라고 권할 수 없다. */}
      <div className="flex flex-col gap-3">
        {/* 거절은 끝이 아니다. 같은 물품으로 다른 기관을 찾는 게 다음 행동인데
            그 길(/match/[donationId])이 화면에 없었다. */}
        {application.status === "rejected" && (
          <Link href={`/match/${application.donationId}`} className={btnSecondary}>
            이 물품으로 다른 곳 찾아보기
          </Link>
        )}
        <Link
          href="/board"
          className={application.status === "rejected" ? `${btnGhost} mx-auto` : btnSecondary}
        >
          다른 요청도 채워보기
        </Link>
        <Link href="/donate" className={`${btnGhost} mx-auto`}>
          새 물품 등록하기
        </Link>
      </div>
    </div>
  );
}

/** 유통기한은 연도가 중요해서 lib의 formatKoreanDate(월·일)로는 부족하다.
 * 이 화면에서만 쓰는 표기라 여기 둔다. */
function formatExpiry(iso: string) {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

