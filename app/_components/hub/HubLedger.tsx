"use client";

import Link from "next/link";
import { useState } from "react";
import type { IntakeView } from "@/lib/hub-store";
import { useAdminCode } from "../AdminCode";
import Loading from "../Loading";
import { OrgMessage } from "../OrgCommon";
import { btnOutline, btnPrimary, caption, card, sectionTitle } from "../../ui";
import { EmptyNote, HubFrame, StageBadge, donorLabel, useHubOverview } from "./HubCommon";

type LedgerRow = {
  at: string;
  kind: "입고" | "제공";
  counterpart: string;
  itemName: string;
  qty: number;
  expiryDate: string | null;
};

/**
 * 모집·제공 장부. 식품기부법은 배분기관이 받은 것과 나눠 준 것을 장부로 남기게 한다.
 * 따로 적지 않아도 입고 승인과 배분 확정이 그대로 한 줄씩 된다.
 */
function buildLedger(intakes: IntakeView[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const i of intakes) {
    if (i.status !== "stored") continue;
    rows.push({
      at: i.approvedAt ?? i.createdAt,
      kind: "입고",
      counterpart: donorLabel(i),
      itemName: i.itemName,
      qty: i.quantity,
      expiryDate: i.expiryDate,
    });
    for (const a of i.allocations) {
      rows.push({
        at: a.at,
        kind: "제공",
        counterpart: a.beneficiaryName,
        itemName: i.itemName,
        qty: a.qty,
        expiryDate: i.expiryDate,
      });
    }
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at));
}

function ymd(iso: string) {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

function downloadCsv(filename: string, rows: LedgerRow[]) {
  const header = ["일자", "구분", "기부자/수혜시설", "품목", "수량", "소비기한"];
  const escape = (v: string | number) => `"${String(v).replaceAll('"', '""')}"`;
  const lines = [
    header.map(escape).join(","),
    ...rows.map((r) =>
      [ymd(r.at), r.kind, r.counterpart, r.itemName, r.qty, r.expiryDate ?? ""].map(escape).join(","),
    ),
  ];
  // BOM이 없으면 엑셀이 한글을 깨뜨려 연다.
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HubLedger({ hubId }: { hubId: string }) {
  const admin = useAdminCode();
  const { data, status } = useHubOverview(hubId);
  const [tab, setTab] = useState<"ledger" | "reports">("ledger");

  if (status === "loading") return <Loading label="장부" size="lg" overlay />;
  if (!data)
    return <OrgMessage title="장부를 불러오지 못했어요" href="/beneficiary" linkLabel="기관 선택으로 돌아가기" />;

  const rows = buildLedger(data.intakes);
  const month = new Date().getMonth() + 1;
  const inQty = rows.filter((r) => r.kind === "입고").reduce((s, r) => s + r.qty, 0);
  const outQty = rows.filter((r) => r.kind === "제공").reduce((s, r) => s + r.qty, 0);
  const reached = new Set(data.intakes.flatMap((i) => i.allocations.map((a) => a.beneficiaryId))).size;
  const reportable = data.intakes.filter((i) => i.status === "stored" && i.allocatedQty > 0);

  return (
    <HubFrame hubId={hubId} hubCategory={data.hub.category} hubName={data.hub.name} admin={admin}>
      <div className="flex gap-1.5">
        {(
          [
            ["ledger", "모집·제공 장부"],
            ["reports", "기업 결과 보고서"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              "h-9 cursor-pointer rounded-full border px-3.5 text-[13px] font-bold " +
              (tab === key
                ? "border-primary-700 bg-primary-700 text-white"
                : "border-neutral-300 bg-white text-neutral-600")
            }
          >
            {text}
          </button>
        ))}
      </div>

      {tab === "ledger" ? (
        <section className={card}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={sectionTitle}>모집·제공 장부 · {month}월</h2>
            <span className="rounded-md bg-primary-700 px-2 py-0.5 text-xs font-bold text-white">자동 작성</span>
          </div>
          <p className={caption}>입고 승인과 배분 확정이 그대로 한 줄씩 기록돼요. 따로 적지 않아도 돼요</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["입고", `${inQty}개`],
              ["제공", `${outQty}개`],
              ["전달 시설", `${reached}곳`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-neutral-50 py-3">
                <p className="text-[18px] font-extrabold">{v}</p>
                <p className="text-xs font-bold text-neutral-500">{k}</p>
              </div>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyNote>입고를 승인하면 장부가 채워져요</EmptyNote>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                    <th className="py-2 pr-2 font-bold">일자</th>
                    <th className="py-2 pr-2 font-bold">구분</th>
                    <th className="py-2 pr-2 font-bold">기부자 / 수혜시설</th>
                    <th className="py-2 pr-2 font-bold">품목</th>
                    <th className="py-2 text-right font-bold">수량</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-neutral-100 last:border-none">
                      <td className="py-2 pr-2 whitespace-nowrap text-neutral-500">{ymd(r.at).slice(5).replace("-", ".")}</td>
                      <td className={`py-2 pr-2 font-bold whitespace-nowrap ${r.kind === "입고" ? "text-primary-700" : "text-neutral-800"}`}>
                        {r.kind}
                      </td>
                      <td className="py-2 pr-2">{r.counterpart}</td>
                      <td className="py-2 pr-2">{r.itemName}</td>
                      <td className="py-2 text-right font-bold">{r.qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <div className="no-print flex gap-2">
              <button
                type="button"
                onClick={() => downloadCsv(`${data.hub.name}_모집제공장부_${month}월.csv`, rows)}
                className={btnOutline}
              >
                엑셀
              </button>
              <button type="button" onClick={() => window.print()} className={`${btnPrimary} h-12! flex-1`}>
                PDF 내보내기
              </button>
            </div>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className={caption}>
            맡긴 기업·개인에게 보낼 결과 보고서예요. 시설별 수령 내역이 자동으로 묶여요
          </p>
          {reportable.length === 0 && <EmptyNote>배분을 확정하면 보고서가 만들어져요</EmptyNote>}
          {reportable.map((i) => (
            <Link
              key={i.id}
              href={`/entrusted/${i.id}`}
              className={`${card} flex-row! items-center transition-colors hover:border-primary-500`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-bold">
                  {donorLabel(i)} · {i.itemName} {i.quantity}개
                </p>
                <p className="text-[13px] text-neutral-500">
                  {new Set(i.allocations.map((a) => a.beneficiaryId)).size}개 시설에 {i.allocatedQty}개 전달
                </p>
              </div>
              <StageBadge intake={i} />
            </Link>
          ))}
        </section>
      )}
    </HubFrame>
  );
}
