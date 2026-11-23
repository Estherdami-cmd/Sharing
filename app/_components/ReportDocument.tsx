"use client";

import { useEffect, useState } from "react";
import type { FormResponse } from "@/lib/form-store";
import type { FormField } from "@/lib/report-form";
import Loading from "./Loading";
import { groupBySection } from "./ReportFill";
import { btnPrimary } from "../ui";

/** "2026-11-25 14:32" (한국 시각). */
function kst(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString();
  return `${d.slice(0, 10)} ${d.slice(11, 16)}`;
}

/** 고르기·체크 칸은 종이 양식처럼 선택지를 다 보이고 고른 것만 칠한다. */
function Boxes({ options, picked }: { options: string[]; picked: string[] }) {
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {options.map((o) => (
        <span key={o} className={picked.includes(o) ? "font-bold" : "text-neutral-500"}>
          {picked.includes(o) ? "■" : "□"} {o}
        </span>
      ))}
    </span>
  );
}

/**
 * 시설이 기업 양식으로 쓴 결과 문서. 기업 양식의 제목·구역·칸 코드·순서 그대로 그린다.
 * 직인·서명 칸은 온라인 승인 기록(보낸 일시·기관)으로 대신한다.
 * "PDF로 저장"은 브라우저 인쇄로 하고, 인쇄할 때는 사이트 머리말·꼬리말과 버튼을 숨긴다.
 */
export default function ReportDocument({ id }: { id: string }) {
  const [doc, setDoc] = useState<FormResponse | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setDoc(d);
        setState("ready");
      })
      .catch(() => setState("missing"));
  }, [id]);

  if (state === "loading") return <Loading label="결과 문서" size="lg" overlay />;
  if (!doc) return <p className="py-16 text-center text-neutral-500">문서를 찾을 수 없어요</p>;

  const approval = `${kst(doc.submittedAt)} · ${doc.auto.facilityName} 계정으로 온라인 승인`;

  function value(f: FormField) {
    if (f.auto) return doc!.auto[f.auto] || "—";
    if (f.by === "company") return f.fixed || "—";
    const v = doc!.values[f.key];
    switch (f.kind) {
      case "choice":
        return <Boxes options={f.options} picked={typeof v === "string" ? [v] : []} />;
      case "checks":
        return <Boxes options={f.options} picked={Array.isArray(v) ? v : []} />;
      case "agree":
        return <Boxes options={[f.hint || "동의합니다"]} picked={v === "동의" ? [f.hint || "동의합니다"] : []} />;
      case "sign":
        return <span className="text-[13px]">{doc!.auto.facilityName} · 온라인 승인 {kst(doc!.submittedAt)}</span>;
      case "photo":
        return Array.isArray(v) && v.length ? (
          <span className="flex flex-wrap gap-2">
            {v.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`${f.label} ${i + 1}`} className="h-36 rounded-lg object-cover" />
            ))}
          </span>
        ) : (
          <span className="text-neutral-400">없음</span>
        );
      default:
        return (typeof v === "string" && v.replace(/ ~ $/, "")) || <span className="text-neutral-400">—</span>;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <style>{`@media print { body > * header.sticky, body footer, .no-print { display: none !important; } body { background: #fff !important; } .report-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; } }`}</style>
      <div className="no-print flex items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">{kst(doc.submittedAt)} 제출</p>
        <button type="button" onClick={() => window.print()} className={`${btnPrimary} h-11! w-auto! px-5`}>
          PDF로 저장 · 인쇄
        </button>
      </div>

      <article className="report-sheet flex flex-col gap-4 rounded-2xl border border-neutral-300 bg-white p-6 text-neutral-900 sm:p-10">
        <div className="flex items-end justify-between gap-4 border-b-4 border-neutral-900 pb-2">
          <p className="text-[20px] font-extrabold">{doc.auto.companyName}</p>
          {doc.form.formCode && <p className="text-right text-[12px] text-neutral-500">양식번호 {doc.form.formCode}</p>}
        </div>
        <div>
          <h1 className="break-keep text-[24px] font-extrabold tracking-[-0.02em] sm:text-[28px]">{doc.form.title}</h1>
          {doc.form.intro && <p className="mt-1 break-keep text-[13px] text-neutral-600">{doc.form.intro}</p>}
        </div>

        {groupBySection(doc.form.fields).map((g, gi) => (
          <section key={gi} className="flex flex-col gap-1.5">
            {g.section && (
              <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
                <span className="grid size-5 place-items-center rounded-full bg-neutral-900 text-[11px] text-white">{gi + 1}</span>
                {g.section}
              </h2>
            )}
            <table className="w-full border-collapse text-[13px]">
              <tbody>
                {g.fields.map((f) => (
                  <tr key={f.key} className="align-top">
                    <th className="w-40 border border-neutral-300 bg-neutral-50 px-3 py-2 text-left font-bold sm:w-48">
                      {f.code && <span className="mr-1 font-mono text-[11px] text-neutral-400">[{f.code}]</span>}
                      {f.label}
                    </th>
                    <td className="whitespace-pre-wrap break-keep border border-neutral-300 px-3 py-2">{value(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}

        {doc.form.closing && <p className="mt-2 text-center text-[15px] font-bold">{doc.form.closing}</p>}
        <p className="text-center text-[13px]">{doc.submittedAt.slice(0, 10).replace(/-/g, ". ")}.</p>
        <div className="rounded-xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-[12px] leading-relaxed text-neutral-700">
          <strong>온라인 확인</strong> · 직인·서명 대신 승인 기록을 남겨요.
          <br />
          승인 기록: {approval}
          <br />
          {doc.auto.hubName}을 거쳐 전달 · 여러시에서 작성
        </div>
      </article>
    </div>
  );
}
