"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AUTO_KEYS, type FieldKind, type ReportForm } from "@/lib/report-form";
import { btnPrimary, caption, card, field } from "../ui";

export type CompanyReportRow = {
  id: string;
  title: string;
  facilityName: string;
  itemName: string;
  quantity: string;
  submittedAt: string;
};

const KIND_LABEL: Record<FieldKind, string> = {
  text: "한 줄",
  long: "여러 줄",
  number: "숫자",
  date: "날짜",
  datetime: "일시",
  period: "기간",
  choice: "고르기",
  checks: "체크",
  agree: "동의",
  photo: "사진",
  sign: "서명",
};

/** 사진은 글씨가 읽힐 만큼만 줄인다. PDF는 그대로 보낸다. */
async function fileToDataUrl(file: File): Promise<string | null> {
  if (file.type === "application/pdf") {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

/**
 * 기업 보고 양식. 기업이 쓰는 결과보고서·수령확인서를 올리면 AI가 칸을 뽑고, 기업은 확인만
 * 하고 저장한다. 그다음부터 이 기업 물품을 받은 시설은 이 양식의 빈칸만 채우면 된다.
 */
export default function CompanyForms({
  code,
  companyName,
  form,
  reports,
  onSaved,
}: {
  code: string;
  companyName: string;
  form: (ReportForm & { source: string; sourceName: string }) | null;
  reports: CompanyReportRow[];
  onSaved: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ form: ReportForm; source: "openai" | "sample" } | null>(null);
  const [status, setStatus] = useState<"idle" | "reading" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  async function pick(file: File | undefined) {
    setError(null);
    if (!file) return;
    const data = await fileToDataUrl(file);
    if (!data) return setError("파일을 열지 못했어요. 사진(JPG·PNG)이나 PDF로 올려주세요");
    setFileName(file.name);
    setFileData(data);
  }

  async function read(sample: boolean) {
    setStatus("reading");
    setError(null);
    const res = await fetch("/api/companies/form/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sample ? { code, sample: true } : { code, file: fileData, fileName }),
    }).catch(() => null);
    setStatus("idle");
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body?.form) return setError(body?.error ?? "양식을 읽지 못했어요");
    setDraft({ form: body.form, source: body.source });
  }

  async function save() {
    if (!draft) return;
    setStatus("saving");
    setError(null);
    const res = await fetch("/api/companies/form", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, form: draft.form, source: draft.source, sourceName: draft.source === "openai" ? fileName : "" }),
    }).catch(() => null);
    setStatus("idle");
    if (!res?.ok) return setError((await res?.json().catch(() => null))?.error ?? "저장하지 못했어요");
    setDraft(null);
    setReplacing(false);
    setFileData(null);
    onSaved();
  }

  function editDraft(next: Partial<ReportForm>) {
    if (draft) setDraft({ ...draft, form: { ...draft.form, ...next } });
  }

  const showUpload = !draft && (!form || replacing);

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-[17px] font-extrabold text-neutral-900">보고 양식</h2>
        <p className={caption}>
          쓰시는 결과보고서·수령확인서를 올리면 AI가 칸을 읽어요. 물품을 받은 시설은 그 양식의 빈칸만
          채우면, {companyName} 양식 그대로 결과 문서가 와요
        </p>
      </div>

      {form && !replacing && !draft && (
        <div className={card}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[15px] font-bold">{form.title}</p>
              <p className={caption}>
                {form.source === "openai" ? `AI가 ${form.sourceName || "올린 파일"}에서 읽음` : "예시 양식"} · 칸{" "}
                {form.fields.length}개
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="shrink-0 cursor-pointer text-[13px] font-bold text-primary-700 underline underline-offset-2"
            >
              다시 올리기
            </button>
          </div>
          <FieldChips form={form} />
        </div>
      )}

      {showUpload && (
        <div className={card}>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 px-4 py-5 text-center hover:border-primary-500"
          >
            <span className="text-[15px] font-bold text-neutral-800">{fileName || "양식 파일 고르기"}</span>
            <span className={caption}>사진(JPG·PNG) 또는 PDF</span>
          </button>
          <button type="button" disabled={!fileData || status !== "idle"} onClick={() => read(false)} className={btnPrimary}>
            {status === "reading" ? "AI가 양식을 읽는 중…" : "AI로 양식 읽기"}
          </button>
          <button
            type="button"
            disabled={status !== "idle"}
            onClick={() => read(true)}
            className="h-11 cursor-pointer rounded-xl border border-neutral-300 bg-white text-[14px] font-bold text-neutral-700 disabled:opacity-50"
          >
            양식이 없으면 · 예시 양식으로 시작
          </button>
          {replacing && (
            <button type="button" onClick={() => setReplacing(false)} className={`${caption} cursor-pointer underline`}>
              취소
            </button>
          )}
        </div>
      )}

      {draft && (
        <div className={`${card} border-primary-500`}>
          <p className="text-xs font-bold text-primary-700">
            {draft.source === "openai" ? "AI가 읽은 양식이에요. 맞는지 확인해주세요" : "예시 양식이에요. 필요 없는 칸은 빼세요"}
          </p>
          <input
            value={draft.form.title}
            onChange={(e) => editDraft({ title: e.target.value })}
            aria-label="양식 제목"
            className={`${field} font-bold`}
          />
          <ul className="flex flex-col gap-1.5">
            {draft.form.fields.map((f, i) => (
              <li key={f.key} className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2">
                <input
                  value={f.label}
                  onChange={(e) =>
                    editDraft({ fields: draft.form.fields.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })
                  }
                  aria-label={`${i + 1}번째 칸 이름`}
                  className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-neutral-800 outline-none"
                />
                {f.code && <span className="shrink-0 font-mono text-[11px] font-bold text-neutral-400">{f.code}</span>}
                <span className="shrink-0 text-[11px] font-bold text-neutral-400">
                  {f.auto ? `자동 · ${AUTO_KEYS[f.auto]}` : f.by === "company" ? "기업이 채움" : KIND_LABEL[f.kind]}
                </span>
                {/* 종이 양식엔 필수 표시가 없는 경우가 많아, 기업이 여기서 정한다. 시설이 쓰는 칸에만 의미가 있다. */}
                {!f.auto && f.by !== "company" && f.kind !== "sign" && (
                  <button
                    type="button"
                    aria-pressed={f.required}
                    onClick={() =>
                      editDraft({ fields: draft.form.fields.map((x, j) => (j === i ? { ...x, required: !x.required } : x)) })
                    }
                    className={
                      "shrink-0 cursor-pointer rounded-full px-2 py-0.5 text-[11px] font-bold " +
                      (f.required ? "bg-danger-bg text-danger-fg" : "bg-neutral-100 text-neutral-400")
                    }
                  >
                    필수
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${f.label} 칸 빼기`}
                  onClick={() => editDraft({ fields: draft.form.fields.filter((_, j) => j !== i) })}
                  className="shrink-0 cursor-pointer text-[16px] text-neutral-400 hover:text-danger-fg"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <button type="button" disabled={status !== "idle" || draft.form.fields.length === 0} onClick={save} className={btnPrimary}>
            {status === "saving" ? "저장하는 중" : "이 양식으로 저장"}
          </button>
          <button type="button" onClick={() => setDraft(null)} className={`${caption} cursor-pointer underline`}>
            다시 고르기
          </button>
        </div>
      )}

      {error && <p className="text-[13px] text-danger-fg">{error}</p>}

      {reports.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] font-bold text-neutral-800">시설이 보낸 결과 문서 {reports.length}건</p>
          {reports.map((r) => (
            <Link
              key={r.id}
              href={`/reports/${r.id}`}
              className="flex items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 hover:bg-neutral-50"
            >
              <div className="min-w-0">
                <p className="truncate text-[14px] font-bold">{r.facilityName}</p>
                <p className={caption}>
                  {r.itemName} · {r.quantity} · {r.submittedAt.slice(0, 10)}
                </p>
              </div>
              <span className="shrink-0 text-[13px] font-bold text-primary-700">문서 보기 →</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function FieldChips({ form }: { form: ReportForm }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {form.fields.map((f) => (
        <span
          key={f.key}
          className={
            "rounded-full px-2.5 py-1 text-[12px] font-bold " +
            (f.auto ? "bg-primary-50 text-primary-700" : "bg-neutral-100 text-neutral-600")
          }
        >
          {f.label}
          {f.auto ? " · 자동" : ""}
        </span>
      ))}
    </div>
  );
}
