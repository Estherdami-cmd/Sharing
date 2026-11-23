"use client";

import { formatQty } from "@/lib/rules";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { checkHubCriteria } from "@/lib/hub";
import type { IntakeView } from "@/lib/hub-store";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import { OrgMessage } from "../OrgCommon";
import { btnDanger, btnOutline, btnPrimary, card, caption, field, label, sectionTitle } from "../../ui";
import {
  CriteriaList,
  DdayBadge,
  HubFrame,
  StageBadge,
  donorLabel,
  hubPath,
  shortDate,
} from "./HubCommon";

function Row({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-none">
      <span className="text-[13px] text-neutral-500">{name}</span>
      <span className="text-right text-[15px] font-bold text-neutral-900">{children}</span>
    </div>
  );
}

/**
 * 입고 확인. 기부자가 사진으로 등록할 때 AI가 읽은 값(초안)과, 우리 기관이 받는 기준을
 * 나란히 보여준다. 받을지 말지는 기관이 정한다 — 기준에 못 미쳐도 승인은 막지 않고 경고만 한다.
 */
export default function IntakeReview({ hubId, intakeId }: { hubId: string; intakeId: string }) {
  const router = useRouter();
  const admin = useAdminCode();
  const [intake, setIntake] = useState<IntakeView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/intakes/${intakeId}`).catch(() => null);
    if (!res?.ok) {
      setStatus("notfound");
      return;
    }
    setIntake(await res.json());
    setStatus("ready");
  }, [intakeId]);

  useEffect(() => {
    load();
  }, [load]);

  // 기업이 맡긴 물품이면 담당자 연락처를 따로 불러온다. 공개 입고 기록에는 없고,
  // 관리 코드가 있어야 나온다. 코드를 넣은 뒤(codeReady) 다시 묻는다.
  const isCompany = intake?.donorType === "company" && Boolean(intake?.donationId);
  const [donorContact, setDonorContact] = useState<
    { manager: string; contact: string } | null | "locked"
  >(null);
  useEffect(() => {
    if (!isCompany) return;
    let cancelled = false;
    fetch(`/api/intakes/${intakeId}/contact`, { headers: admin.authHeaders() })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401 || res.status === 503) return setDonorContact("locked");
        const body = res.ok ? await res.json().catch(() => null) : null;
        setDonorContact(body?.contact ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCompany, intakeId, admin.codeReady, admin.authHeaders]);

  async function review(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await admin.adminFetch(
      `/api/intakes/${intakeId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      },
      () => review(action),
    );
    setBusy(false);
    if (res.status === 401) return;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "처리하지 못했어요");
      return;
    }
    setIntake(body);
    if (action === "approve") router.push(`${hubPath(hubId)}/storage?new=${intakeId}`);
  }

  if (status === "loading") return <Loading label="입고 정보" size="lg" overlay />;
  if (status === "notfound" || !intake || intake.hubId !== hubId)
    return (
      <OrgMessage title="입고 기록을 찾을 수 없어요" href={hubPath(hubId)} linkLabel="대시보드로" />
    );

  const { checks, ok } = checkHubCriteria(intake);

  return (
    <HubFrame hubId={hubId} hubName={intake.hubName} admin={admin}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">입고 확인</h2>
          <StageBadge intake={intake} />
        </div>

        {intake.productImageUrl && (
          <img
            src={intake.productImageUrl}
            alt={`${intake.itemName} 사진`}
            className="max-h-64 w-full rounded-2xl border border-neutral-200 bg-white object-contain"
          />
        )}

        <section className={card}>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary-700 px-2 py-0.5 text-xs font-bold text-white">
              AI 초안
            </span>
            <span className={caption}>기부자 사진에서 읽은 값이에요. 실물과 다르면 반려 사유에 적어주세요</span>
          </div>
          <div>
            <Row name="품목">{intake.itemName}</Row>
            <Row name="분류">{intake.category}</Row>
            <Row name="수량">{formatQty(intake.quantity, intake.packing)}</Row>
            <Row name="소비기한">
              <span className="inline-flex items-center gap-2">
                {intake.expiryDate ? intake.expiryDate.replaceAll("-", ".") : "없음"}
                <DdayBadge expiryDate={intake.expiryDate} />
              </span>
            </Row>
            <Row name="보낸 곳">
              {donorLabel(intake)} · {shortDate(intake.createdAt)}
            </Row>
            {isCompany && (
              <Row name="담당자 연락처">
                {donorContact === "locked" ? (
                  <span className="text-[13px] font-normal text-neutral-400">관리 코드를 확인하면 보여요</span>
                ) : donorContact ? (
                  <>
                    {donorContact.manager && `${donorContact.manager} · `}
                    <a href={`tel:${donorContact.contact}`} className="text-primary-700 hover:text-primary-800">
                      {donorContact.contact}
                    </a>
                  </>
                ) : (
                  <span className="text-[13px] font-normal text-neutral-400">등록된 연락처 없음</span>
                )}
              </Row>
            )}
          </div>
        </section>

        <section className={card}>
          <h3 className={sectionTitle}>우리 기관 받는 기준</h3>
          <CriteriaList checks={checks} />
          {!ok && (
            <p className="text-[13px] text-warning-fg">
              기준에 못 미치는 항목이 있어요. 받을지 기관에서 판단해주세요
            </p>
          )}
          <p className={caption}>실물 포장 상태는 입고 때 직접 확인해주세요</p>
        </section>

        {error && <p className="text-[14px] text-danger-fg">{error}</p>}

        {intake.status === "pending" ? (
          rejecting ? (
            <section className={card}>
              <label htmlFor="reject-reason" className={label}>
                반려 사유 (기부자에게 보여요)
              </label>
              <input
                id="reject-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예: 보관 공간이 부족해요"
                className={field}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setRejecting(false)} className={btnOutline}>
                  취소
                </button>
                <button type="button" disabled={busy} onClick={() => review("reject")} className={btnDanger}>
                  반려하기
                </button>
              </div>
            </section>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setRejecting(true)}
                className="h-14 w-28 shrink-0 cursor-pointer rounded-xl border-2 border-primary-700 bg-white text-[15px] font-bold text-primary-700 hover:bg-primary-50"
              >
                반려
              </button>
              <button type="button" disabled={busy} onClick={() => review("approve")} className={btnPrimary}>
                {busy ? "처리 중" : "승인 · 보관으로"}
              </button>
            </div>
          )
        ) : intake.status === "stored" ? (
          <div className="flex flex-col gap-2">
            {intake.remainingQty > 0 && (
              <Link href={`${hubPath(hubId)}/intakes/${intake.id}/distribute`} className={btnPrimary}>
                배분하기 ({intake.remainingQty}개 남음)
              </Link>
            )}
            <Link
              href={`/entrusted/${intake.id}`}
              className="text-center text-[14px] font-bold text-primary-700 hover:text-primary-800"
            >
              결과 보고서 보기 →
            </Link>
          </div>
        ) : (
          <p className="rounded-xl bg-neutral-100 px-4 py-3 text-[14px] text-neutral-600">
            반려한 입고예요{intake.rejectReason ? ` · ${intake.rejectReason}` : ""}
          </p>
        )}
      </div>
    </HubFrame>
  );
}
