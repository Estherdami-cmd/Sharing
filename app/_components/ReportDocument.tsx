"use client";

import { useEffect, useState } from "react";
import type { FormResponse } from "@/lib/form-store";
import Loading from "./Loading";
import { btnPrimary } from "../ui";

/**
 * 시설이 기업 양식으로 쓴 결과 문서. 기업 양식의 제목·칸 순서 그대로 표로 그린다.
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <style>{`@media print { body > * header.sticky, body footer, .no-print { display: none !important; } body { background: #fff !important; } .report-sheet { border: none !important; box-shadow: none !important; } }`}</style>
      <div className="no-print flex items-center justify-between gap-2">
        <p className="text-[13px] text-neutral-500">{doc.submittedAt.slice(0, 10)} 제출</p>
        <button type="button" onClick={() => window.print()} className={`${btnPrimary} h-11! w-auto! px-5`}>
          PDF로 저장 · 인쇄
        </button>
      </div>

      <article className="report-sheet flex flex-col gap-5 rounded-2xl border border-neutral-300 bg-white p-6 text-neutral-900 sm:p-10">
        <div className="flex flex-col items-center gap-1 border-b-2 border-neutral-900 pb-4 text-center">
          <h1 className="break-keep text-[22px] font-extrabold tracking-[-0.02em] sm:text-[26px]">{doc.form.title}</h1>
          {doc.form.intro && <p className="break-keep text-[13px] text-neutral-600">{doc.form.intro}</p>}
        </div>

        <table className="w-full border-collapse text-[14px]">
          <tbody>
            {doc.form.fields.map((f) => {
              const value = f.auto ? doc.auto[f.auto] : doc.values[f.key];
              return (
                <tr key={f.key} className="align-top">
                  <th className="w-32 border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-left font-bold sm:w-40">{f.label}</th>
                  <td className="whitespace-pre-wrap break-keep border border-neutral-300 px-3 py-2.5">
                    {Array.isArray(value) ? (
                      value.length ? (
                        <div className="flex flex-wrap gap-2">
                          {value.map((src, i) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={i} src={src} alt={`${f.label} ${i + 1}`} className="h-40 rounded-lg object-cover" />
                          ))}
                        </div>
                      ) : (
                        <span className="text-neutral-400">없음</span>
                      )
                    ) : (
                      value || <span className="text-neutral-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="text-right text-[12px] text-neutral-500">
          {doc.auto.hubName}을 거쳐 전달 · 여러시에서 작성 · {doc.submittedAt.slice(0, 10)}
        </p>
      </article>
    </div>
  );
}
