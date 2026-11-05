"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatKoreanDate } from "@/lib/rules";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import NeedProgress from "./NeedProgress";
import {
  type ApplicationRow,
  BackLink,
  OrgMessage,
  STATUS_BADGE,
  mismatchNotice,
  orgHomePath,
  progressGain,
} from "./OrgCommon";
import { useRefetchOnFocus } from "./useRefetchOnFocus";
import {
  btnDanger,
  btnOutline,
  btnPrimary,
  caption,
  card,
  label,
  pageTitle,
  sectionTitle,
  toneBadge,
} from "../ui";

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[14px]">
      <dt className="shrink-0 text-neutral-500">{name}</dt>
      <dd className="break-keep text-right font-semibold text-neutral-900">{children}</dd>
    </div>
  );
}

function candidateKey(c: { date: string; slot: string }) {
  return `${c.date}|${c.slot}`;
}

export default function ApplicationReview({
  orgId,
  applicationId,
}: {
  orgId: string;
  applicationId: string;
}) {
  const admin = useAdminCode();
  const { authHeaders, adminFetch, codeState } = admin;
  const homePath = orgHomePath(orgId);
  const [app, setApp] = useState<ApplicationRow | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 방금 이 화면에서 처리했을 때만 채운다. 진행률이 어디서 어디로 움직였는지 보여주려고
  // 처리 직전 값을 잡아둔다 — 수락 응답에는 이미 오른 값만 있다.
  const [justDecided, setJustDecided] = useState<{ before: number | null } | null>(null);
  // 늦게 도착한 조회 응답이 방금 처리한 결과를 옛 상태로 덮어쓰지 않게 한다.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const res = await fetch(`/api/applications/${applicationId}`, {
      headers: authHeaders(),
    }).catch(() => null);
    if (seq !== loadSeq.current) return;
    if (res?.status === 404) {
      setStatus("missing");
      return;
    }
    if (!res?.ok) {
      setStatus((prev) => (prev === "ready" ? prev : "failed"));
      return;
    }
    const data: ApplicationRow = await res.json();
    if (seq !== loadSeq.current) return;
    // 주소만 바꿔 다른 기관 신청을 여는 길을 막는다. 공용 코드라 권한 경계는 아니고,
    // 엉뚱한 기관 홈으로 돌아가는 일을 막는 장치다.
    if (data.beneficiaryId !== orgId) {
      setStatus("missing");
      return;
    }
    setApp(data);
    setStatus("ready");
  }, [applicationId, authHeaders, orgId]);

  // 코드 확인이 끝난 뒤에 불러와야 연락처가 함께 온다. 코드를 넣으면 다시 불러온다.
  useEffect(() => {
    if (codeState === "checking") return;
    load();
  }, [codeState, load]);

  useRefetchOnFocus(load);

  async function decide(
    decision: "accepted" | "rejected",
    confirmed?: { date: string; slot: string },
  ) {
    if (!app || submitting) return;
    setSubmitting(true);
    setError(null);
    loadSeq.current += 1;
    const before = app.need?.progress ?? null;
    const res = await adminFetch(
      `/api/applications/${app.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: decision,
          confirmedDate: confirmed?.date,
          confirmedSlot: confirmed?.slot,
        }),
      },
      () => decide(decision, confirmed),
    ).catch(() => null);
    setSubmitting(false);
    if (res?.status === 401) return; // 코드 입력란으로 데려갔다. 넣으면 이어서 처리한다.
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      setError(body?.error ?? "처리하지 못했어요. 다시 시도해주세요");
      return;
    }
    setApp(await res.json());
    setJustDecided({ before });
    setConfirmingReject(false);
    window.scrollTo({ top: 0 });
  }

  if (status === "loading") return <Loading label="신청 내용" size="lg" overlay />;
  if (status === "missing" || !app) {
    return (
      <OrgMessage
        title={status === "missing" ? "이 기관의 신청을 찾을 수 없어요" : "신청을 불러오지 못했어요"}
        description={status === "missing" ? undefined : "잠시 뒤 새로고침해주세요"}
        href={homePath}
        linkLabel="기관 홈으로"
      />
    );
  }

  const contact = app.contact ? (
    <a href={`tel:${app.contact}`} className="text-primary-700 hover:text-primary-800">
      {app.contact}
    </a>
  ) : admin.codeState === "needed" ? (
    <span className="font-normal text-neutral-500">관리 코드를 넣으면 보여요</span>
  ) : (
    "-"
  );

  const delivery = (
    <dl className="flex flex-col gap-2">
      {app.confirmedDate && (
        <Row name="확정 일정">
          {formatKoreanDate(app.confirmedDate)} {app.confirmedSlot}
        </Row>
      )}
      <Row name="전달 장소">{app.place}</Row>
      <Row name="기부자 연락처">{contact}</Row>
    </dl>
  );

  const item = (
    <dl className="flex flex-col gap-2">
      <Row name="물품">{app.donation.itemName}</Row>
      <Row name="카테고리">{app.donation.category}</Row>
      <Row name="수량">{app.quantity}개</Row>
      {app.donation.expiryDate && <Row name="유통기한">{app.donation.expiryDate}</Row>}
    </dl>
  );

  /* ── 처리가 끝난 신청: 방금 처리했으면 결과 화면, 아니면 기록 ── */
  if (app.status !== "pending") {
    const accepted = app.status === "accepted";
    const after = app.need?.progress ?? null;
    const moved =
      justDecided && justDecided.before !== null && after !== null && justDecided.before !== after;
    const title = justDecided
      ? accepted
        ? "신청을 수락했어요"
        : "신청을 거절했어요"
      : accepted
        ? "수락한 신청이에요"
        : "거절한 신청이에요";

    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <BackLink href={homePath}>기관 홈</BackLink>
        <header className="flex flex-col items-start gap-2" aria-live="polite">
          <span className={toneBadge(STATUS_BADGE[app.status].tone)}>
            {STATUS_BADGE[app.status].label}
          </span>
          <h1 className={pageTitle}>{title}</h1>
          {justDecided && accepted && (
            <p className={caption}>기부자에게 연락해 전달 일정을 안내해주세요</p>
          )}
        </header>

        {app.need && accepted && (
          <section className={card}>
            <h2 className={`${sectionTitle} break-keep`}>{app.need.itemName} 진행률</h2>
            {moved && (
              <p className="text-[15px] font-bold text-primary-700">
                {justDecided.before}% → {after}%로 올랐어요
              </p>
            )}
            {justDecided && !moved && (
              <p className={caption}>이번 수락으로 진행률은 달라지지 않았어요</p>
            )}
            <NeedProgress
              filledQty={app.need.filledQty}
              targetQty={app.need.targetQty}
              progress={app.need.progress}
              pendingQty={app.need.pendingQty}
            />
          </section>
        )}

        <section className={card}>
          {accepted && (
            <>
              {delivery}
              <hr className="border-neutral-100" />
            </>
          )}
          {item}
          {app.receiptRequested && (
            <p className="text-[13px] font-semibold text-success-fg">기부금 신청서 작성 요청됨</p>
          )}
        </section>

        <AdminCodeField {...admin.field} />

        <div className="flex flex-col gap-2">
          <Link href={homePath} className={btnPrimary}>
            기관 홈으로
          </Link>
          {/* btnOutline의 flex-1은 세로 배치 안에서 높이를 없앤다. 가로 줄로 감싼다. */}
          {accepted && (
            <div className="flex">
              <Link href="/board" className={btnOutline}>
                진행 현황 보기
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── 대기중 신청: 내용을 확인하고 처리한다 ── */
  const gain = progressGain(app);
  const notice = mismatchNotice(app);
  const chosen = app.candidateDates.find((c) => candidateKey(c) === selected) ?? null;
  const images = [
    { src: app.donation.productImageUrl, alt: "기부자가 올린 제품 사진" },
    { src: app.donation.expiryImageUrl, alt: "기부자가 올린 유통기한 사진" },
  ].filter((image): image is { src: string; alt: string } => Boolean(image.src));

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <BackLink href={homePath}>기관 홈</BackLink>
      <header className="flex items-center justify-between gap-3">
        <h1 className={pageTitle}>신청 확인</h1>
        <span className={toneBadge(STATUS_BADGE.pending.tone)}>{STATUS_BADGE.pending.label}</span>
      </header>

      <AdminCodeField {...admin.field} />

      <section className={card}>
        <h2 className={sectionTitle}>기부 물품</h2>
        {/* 문구만으로는 포장 상태나 라벨이 맞는지 알 수 없어, 기부자가 올린 사진을 그대로 보여준다. */}
        {images.length > 0 && (
          <div className="flex gap-2">
            {images.map((image) => (
              <a key={image.alt} href={image.src} target="_blank" rel="noopener noreferrer">
                <img
                  src={image.src}
                  alt={image.alt}
                  className="size-28 rounded-xl border border-neutral-200 object-cover"
                />
              </a>
            ))}
          </div>
        )}
        {item}
        {notice && <p className="text-[13px] text-warning-fg">{notice}</p>}
      </section>

      {app.need && (
        <section className={card}>
          <h2 className={`${sectionTitle} break-keep`}>{app.need.itemName} 요청</h2>
          <NeedProgress
            filledQty={app.need.filledQty}
            targetQty={app.need.targetQty}
            progress={app.need.progress}
            pendingQty={app.need.pendingQty}
          />
        </section>
      )}

      <section className={card}>
        <h2 className={sectionTitle}>전달 정보</h2>
        {delivery}
      </section>

      <section className={card}>
        <div>
          <h2 className={sectionTitle}>전달 날짜 선택</h2>
          <p className={`${caption} mt-1`}>기부자가 제안한 날짜 중 하나를 골라 수락해요</p>
        </div>
        <div role="radiogroup" aria-label="전달 날짜" className="flex flex-col gap-2">
          {app.candidateDates.map((c) => {
            const key = candidateKey(c);
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelected(key)}
                className={
                  "h-12 cursor-pointer rounded-xl border-2 px-4 text-left text-[14px] font-bold transition-colors " +
                  (active
                    ? "border-primary-600 bg-primary-50 text-primary-800"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400")
                }
              >
                {formatKoreanDate(c.date)} {c.slot}
              </button>
            );
          })}
        </div>

        {error && <p className="text-[13px] text-danger-fg">{error}</p>}

        {/* 누르기 전에 무슨 일이 일어나는지 버튼이 말해준다. */}
        <button
          type="button"
          disabled={!chosen || submitting}
          onClick={() => chosen && decide("accepted", chosen)}
          className={btnPrimary}
        >
          {submitting
            ? "처리 중..."
            : !chosen
              ? "날짜를 골라주세요"
              : gain
                ? `이 날짜로 수락 (진행률 +${gain})`
                : "이 날짜로 수락"}
        </button>
        {gain === 0 && <p className={caption}>이미 목표를 달성한 요청이라 진행률은 오르지 않아요</p>}

        {/* 거절은 기부자의 제안을 되돌리는 일이라 수락과 달리 한 번 더 묻는다. */}
        {confirmingReject ? (
          <div className="flex flex-col gap-2">
            <p className={label}>이 신청을 거절할까요?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingReject(false)}
                className={btnOutline}
              >
                취소
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => decide("rejected")}
                className={btnDanger}
              >
                거절하기
              </button>
            </div>
          </div>
        ) : (
          /* btnDanger의 flex-1은 세로 배치 안에서 높이를 없앤다. 가로 줄로 감싼다. */
          <div className="flex">
            <button
              type="button"
              onClick={() => setConfirmingReject(true)}
              className={btnDanger}
            >
              거절
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
