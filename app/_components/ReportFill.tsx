"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  type AutoKey,
  type FormField,
  type FormValues,
  MAX_PHOTOS,
  type ReportForm,
  isRecipientInput,
  missingRequired,
} from "@/lib/report-form";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import { BackLink, OrgMessage } from "./OrgCommon";
import { btnPrimary, caption, card, field, pageDesc, pageTitle } from "../ui";

async function shrinkPhoto(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return null;
  }
}

/** 칸을 구역(기부자·수령 기관…)별로 묶는다. 구역이 없는 양식은 한 덩어리다. */
export function groupBySection(fields: FormField[]) {
  const groups: { section: string; fields: FormField[] }[] = [];
  for (const f of fields) {
    const last = groups[groups.length - 1];
    if (last && last.section === f.section) last.fields.push(f);
    else groups.push({ section: f.section, fields: [f] });
  }
  return groups;
}

const pill = (on: boolean) =>
  "h-9 cursor-pointer rounded-full border px-3 text-[13px] font-bold " +
  (on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-neutral-300 bg-white text-neutral-500");

/**
 * 시설이 기업 양식으로 결과를 쓴다. 배분 기록으로 알 수 있는 칸(기관명·품목·수량·날짜…)과
 * 기업이 미리 채운 칸은 잠겨 있고, 시설은 빈칸만 쓴다. 서명·직인은 온라인 승인 기록으로 대신한다.
 */
export default function ReportFill({
  orgId,
  intakeId,
  allocationId,
  formId,
}: {
  orgId: string;
  intakeId: string;
  allocationId: string;
  formId: string | null;
}) {
  const query = formId ? `?form=${encodeURIComponent(formId)}` : "";
  const router = useRouter();
  const admin = useAdminCode();
  const [data, setData] = useState<{ form: ReportForm; auto: Record<AutoKey, string>; companyName: string } | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/report/${intakeId}/${allocationId}${query}`).catch(() => null);
    if (!res?.ok) return setStatus("missing");
    const body = await res.json();
    setData(body);
    if (body.response) setValues(body.response.values);
    setStatus("ready");
  }, [intakeId, allocationId, query]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: string, v: string | string[]) => setValues((prev) => ({ ...prev, [key]: v }));
  const list = (key: string) => (values[key] as string[] | undefined) ?? [];
  const text = (key: string) => (values[key] as string | undefined) ?? "";

  async function addPhotos(key: string, files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - list(key).length;
    const added = (await Promise.all([...files].slice(0, room).map(shrinkPhoto))).filter((p): p is string => !!p);
    set(key, [...list(key), ...added]);
  }

  async function submit() {
    if (!data) return;
    const missing = missingRequired(data.form, values);
    if (missing.length) return setError(`${missing.join(", ")}을(를) 채워주세요`);
    setStatus("saving");
    setError(null);
    const res = await admin.adminFetch(
      `/api/report/${intakeId}/${allocationId}${query}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values }) },
      submit,
    );
    if (!res.ok) {
      setStatus("ready");
      return setError((await res.json().catch(() => null))?.error ?? "보내지 못했어요. 다시 시도해주세요");
    }
    const { id } = await res.json();
    router.push(`/reports/${id}`);
  }

  if (status === "loading") return <Loading label="기업 양식" size="lg" overlay />;
  if (status === "missing" || !data)
    return <OrgMessage title="작성할 양식을 찾을 수 없어요" href={`/beneficiary/${orgId}/deliveries`} linkLabel="받을 물품으로 돌아가기" />;

  function input(f: FormField) {
    const id = `rf-${f.key}`;
    if (f.auto) return <p className="rounded-xl bg-primary-50 px-4 py-3 text-[15px] font-bold text-primary-700">{data!.auto[f.auto] || "—"}</p>;
    if (f.by === "company")
      return (
        <p className="rounded-xl bg-neutral-100 px-4 py-3 text-[14px] text-neutral-500">
          {f.fixed || `${data!.companyName}가 문서를 받은 뒤 채워요`}
        </p>
      );
    switch (f.kind) {
      case "long":
        return <textarea id={id} rows={4} value={text(f.key)} onChange={(e) => set(f.key, e.target.value)} maxLength={1000} className={`${field} h-auto py-3`} />;
      case "choice":
        return (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label}>
            {f.options.map((o) => (
              <button key={o} type="button" role="radio" aria-checked={text(f.key) === o} onClick={() => set(f.key, o)} className={pill(text(f.key) === o)}>
                {o}
              </button>
            ))}
          </div>
        );
      case "checks":
        return (
          <div className="flex flex-wrap gap-1.5">
            {f.options.map((o) => {
              const on = list(f.key).includes(o);
              return (
                <button key={o} type="button" role="checkbox" aria-checked={on} onClick={() => set(f.key, on ? list(f.key).filter((x) => x !== o) : [...list(f.key), o])} className={pill(on)}>
                  {on ? "☑" : "☐"} {o}
                </button>
              );
            })}
          </div>
        );
      case "agree": {
        const on = text(f.key) === "동의";
        return (
          <button type="button" role="checkbox" aria-checked={on} onClick={() => set(f.key, on ? "" : "동의")} className={`${pill(on)} h-auto! py-2 text-left`}>
            {on ? "☑" : "☐"} {f.hint || "동의합니다"}
          </button>
        );
      }
      case "period": {
        const [a = "", b = ""] = text(f.key).split(" ~ ");
        return (
          <div className="flex items-center gap-2">
            <input id={id} type="date" value={a} onChange={(e) => set(f.key, `${e.target.value} ~ ${b}`)} className={field} />
            <span className="text-neutral-400">~</span>
            <input type="date" aria-label={`${f.label} 끝`} value={b} onChange={(e) => set(f.key, `${a} ~ ${e.target.value}`)} className={field} />
          </div>
        );
      }
      case "sign":
        return <p className="rounded-xl bg-neutral-100 px-4 py-3 text-[13px] text-neutral-500">온라인 승인 기록(보낸 일시·기관)으로 대신해요</p>;
      case "photo":
        return (
          <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {list(f.key).map((src, i) => (
              <button key={i} type="button" aria-label="사진 빼기" onClick={() => set(f.key, list(f.key).filter((_, j) => j !== i))} className="relative size-24 cursor-pointer overflow-hidden rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="size-full object-cover" />
                <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[12px] text-white">×</span>
              </button>
            ))}
            {list(f.key).length < MAX_PHOTOS && (
              <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-neutral-300 text-[13px] font-bold text-neutral-500">
                + 사진
                <input id={id} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(f.key, e.target.files)} />
              </label>
            )}
          </div>
          {/* 종이 양식 붙임의 "설명" 칸. 촬영 일자는 보낸 날로 문서에 남는다. */}
          <input
            aria-label={`${f.label} 설명`}
            placeholder="사진 설명 (선택)"
            value={text(`${f.key}__note`)}
            onChange={(e) => set(`${f.key}__note`, e.target.value)}
            maxLength={100}
            className={field}
          />
          </div>
        );
      default:
        return (
          <input
            id={id}
            type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : f.kind === "datetime" ? "datetime-local" : "text"}
            value={text(f.key)}
            onChange={(e) => set(f.key, e.target.value)}
            maxLength={100}
            className={field}
          />
        );
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <BackLink href={`/beneficiary/${orgId}/deliveries`}>받을 물품</BackLink>
      <header className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-primary-700">
          {data.companyName} 양식{data.form.formCode ? ` · ${data.form.formCode}` : ""}
        </p>
        <h1 className={`${pageTitle} break-keep`}>{data.form.title}</h1>
        {data.form.intro && <p className={`${pageDesc} mt-0!`}>{data.form.intro}</p>}
        <p className={caption}>초록 칸은 배분 기록으로 채웠고, 회색 칸은 {data.companyName}가 채워요. 빈칸만 써 주세요</p>
      </header>

      {groupBySection(data.form.fields).map((g, gi) => (
        <section key={gi} className={card}>
          {g.section && (
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-neutral-900">
              <span className="grid size-6 place-items-center rounded-full bg-neutral-900 text-[12px] text-white">{gi + 1}</span>
              {g.section}
            </h2>
          )}
          {g.fields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={`rf-${f.key}`} className="text-xs font-bold text-neutral-700">
                {f.code && <span className="mr-1 font-mono text-neutral-400">[{f.code}]</span>}
                {f.label}
                {f.required && isRecipientInput(f) && f.kind !== "sign" && <span className="text-danger-fg"> *</span>}
              </label>
              {input(f)}
              {f.hint && isRecipientInput(f) && f.kind !== "agree" && <p className={caption}>{f.hint}</p>}
            </div>
          ))}
        </section>
      ))}

      {data.form.closing && <p className="text-center text-[15px] font-bold text-neutral-800">{data.form.closing}</p>}
      {/* 관리 코드가 필요할 때만 칸이 나타난다. 빈 상자가 남지 않게 따로 감싸지 않는다. */}
      <AdminCodeField {...admin.field} />
      {error && <p className="text-[13px] text-danger-fg">{error}</p>}
      <button type="button" disabled={status === "saving" || !admin.codeReady} onClick={submit} className={btnPrimary}>
        {status === "saving" ? "보내는 중" : `수령 승인 · ${data.companyName}에 보내기`}
      </button>
    </div>
  );
}
