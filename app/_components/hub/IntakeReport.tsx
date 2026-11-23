"use client";

import { formatQty } from "@/lib/rules";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { IntakeView } from "@/lib/hub-store";
import Loading from "../Loading";
import { btnGhost, btnSecondary, caption, card, pageDesc, pageTitle, sectionTitle } from "../../ui";
import { DONOR_TYPE_LABEL, StageBadge, donorLabel, shortDate } from "./HubCommon";

const POLL_MS = 5000;

function Step({ done, title, sub }: { done: boolean; title: string; sub?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className={`mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold ${
          done ? "bg-primary-700 text-white" : "border-2 border-neutral-300 bg-white"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <div>
        <p className={`text-[15px] font-bold ${done ? "text-neutral-900" : "text-neutral-400"}`}>{title}</p>
        {sub && <p className="text-[13px] text-neutral-500">{sub}</p>}
      </div>
    </li>
  );
}

/**
 * 맡긴 물품의 진행 상황과 결과 보고서. 기부자(기업·개인)와 배분기관이 같은 화면을 본다.
 * 기업은 이 화면을 PDF로 내보내 지속가능경영보고서의 사회공헌 실적·증빙으로 쓴다.
 */
export default function IntakeReport({ intakeId }: { intakeId: string }) {
  const [intake, setIntake] = useState<IntakeView | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "notfound">("loading");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      const res = await fetch(`/api/intakes/${intakeId}`).catch(() => null);
      if (!alive) return;
      if (!res?.ok) {
        setStatus((s) => (s === "ready" ? s : "notfound"));
      } else {
        const data: IntakeView = await res.json();
        setIntake(data);
        setStatus("ready");
        // 배분기관이 처리하는 동안만 짧게 다시 묻는다. 다 나눴으면 멈춘다.
        if (data.status === "rejected" || (data.status === "stored" && data.remainingQty === 0)) return;
      }
      timer = setTimeout(load, POLL_MS);
    }
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [intakeId]);

  if (status === "loading") return <Loading label="맡긴 물품" size="lg" overlay />;
  if (!intake)
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-[15px] text-neutral-500">맡긴 물품 기록을 찾을 수 없어요</p>
        <Link href="/donate" className={`${btnSecondary} max-w-xs`}>
          물품 등록하러 가기
        </Link>
      </div>
    );

  const byFacility = new Map<string, { name: string; qty: number; last: string; items: Set<string> }>();
  for (const a of intake.allocations) {
    const row = byFacility.get(a.beneficiaryId) ?? { name: a.beneficiaryName, qty: 0, last: a.at, items: new Set() };
    row.qty += a.qty;
    row.last = a.at > row.last ? a.at : row.last;
    row.items.add(a.needItemName);
    byFacility.set(a.beneficiaryId, row);
  }
  const rows = [...byFacility.values()];
  const firstAt = intake.allocations[0]?.at;
  const lastAt = intake.allocations.at(-1)?.at;
  const fullyDone = intake.status === "stored" && intake.remainingQty === 0;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>{fullyDone ? "결과 보고서" : "맡긴 물품"}</h1>
        <p className={pageDesc}>
          {intake.status === "pending"
            ? `${intake.hubName}이(가) 입고를 확인하고 있어요`
            : intake.status === "rejected"
              ? "이번에는 배분기관이 받지 못했어요"
              : fullyDone
                ? "필요한 시설에 모두 전달됐어요"
                : `${intake.hubName}이(가) 보관 중이에요. 필요한 시설에 나누고 있어요`}
        </p>
      </header>

      <section className={card}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[17px] font-bold">
              {donorLabel(intake)} · {intake.itemName} {formatQty(intake.quantity, intake.packing)}
            </p>
            <p className={caption}>
              {intake.hubName} 경유
              {firstAt && ` · ${shortDate(firstAt)}${lastAt && lastAt.slice(0, 10) !== firstAt.slice(0, 10) ? ` ~ ${shortDate(lastAt)}` : ""}`}
            </p>
          </div>
          <StageBadge intake={intake} />
        </div>
        <ol className="flex flex-col gap-3 pt-1">
          <Step done title="배분기관에 맡김" sub={`${shortDate(intake.createdAt)} · ${DONOR_TYPE_LABEL[intake.donorType]}`} />
          <Step
            done={intake.status === "stored"}
            title={intake.status === "rejected" ? "반려됨" : "입고 승인 · 보관"}
            sub={
              intake.status === "rejected"
                ? intake.rejectReason ?? undefined
                : intake.approvedAt
                  ? shortDate(intake.approvedAt)
                  : undefined
            }
          />
          <Step
            done={intake.allocatedQty > 0}
            title={`시설에 배분 ${intake.allocatedQty}/${intake.quantity}개`}
            sub={rows.length > 0 ? `${rows.length}곳에 전달` : undefined}
          />
        </ol>
      </section>

      {rows.length > 0 && (
        <section className={card}>
          <h2 className={sectionTitle}>시설별 수령 확인</h2>
          <div>
            {rows.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2.5 last:border-none"
              >
                <span className="min-w-0 truncate text-[14px] text-neutral-800">{r.name}</span>
                <span className="shrink-0 text-[14px] font-bold">
                  {r.qty}개 · {shortDate(r.last)} <span className="text-primary-700">✓</span>
                </span>
              </div>
            ))}
          </div>
          <p className="rounded-xl bg-warning-bg px-3 py-2 text-[13px] text-warning-fg">
            지속가능경영보고서 사회공헌 항목에 그대로 쓸 수 있게 정리했어요
          </p>
        </section>
      )}

      {intake.expiryDate && (
        <p className="text-center text-[13px] text-neutral-500">
          소비기한 {intake.expiryDate.replaceAll("-", ".")} · {intake.category}
        </p>
      )}

      <div className="no-print flex flex-col gap-2">
        {rows.length > 0 && (
          <button type="button" onClick={() => window.print()} className={btnSecondary}>
            PDF로 내보내기
          </button>
        )}
        <Link href="/board" className={`${btnGhost} text-center`}>
          기부 현황 보기
        </Link>
      </div>
    </div>
  );
}
