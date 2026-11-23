"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { type AutoKey, type FormValues, MAX_PHOTOS, type ReportForm, missingRequired } from "@/lib/report-form";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import { BackLink, OrgMessage } from "./OrgCommon";
import { btnPrimary, caption, card, field, label, pageDesc, pageTitle } from "../ui";

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

/**
 * 시설이 기업 양식으로 결과를 쓴다. 배분 기록으로 알 수 있는 칸(기관명·품목·수량·날짜…)은
 * 이미 채워져 잠겨 있고, 시설은 빈칸만 쓴다.
 */
export default function ReportFill({ orgId, intakeId, allocationId }: { orgId: string; intakeId: string; allocationId: string }) {
  const router = useRouter();
  const admin = useAdminCode();
  const [data, setData] = useState<{ form: ReportForm; auto: Record<AutoKey, string>; companyName: string } | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "saving">("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/report/${intakeId}/${allocationId}`).catch(() => null);
    if (!res?.ok) return setStatus("missing");
    const body = await res.json();
    setData(body);
    if (body.response) setValues(body.response.values);
    setStatus("ready");
  }, [intakeId, allocationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addPhotos(key: string, files: FileList | null) {
    if (!files) return;
    const current = (values[key] as string[] | undefined) ?? [];
    const room = MAX_PHOTOS - current.length;
    const added = (await Promise.all([...files].slice(0, room).map(shrinkPhoto))).filter((p): p is string => !!p);
    setValues({ ...values, [key]: [...current, ...added] });
  }

  async function submit() {
    if (!data) return;
    const missing = missingRequired(data.form, values);
    if (missing.length) return setError(`${missing.join(", ")}을(를) 채워주세요`);
    setStatus("saving");
    setError(null);
    const res = await admin.adminFetch(
      `/api/report/${intakeId}/${allocationId}`,
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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <BackLink href={`/beneficiary/${orgId}/deliveries`}>받을 물품</BackLink>
      <header className="flex flex-col gap-1.5">
        <p className="text-xs font-bold text-primary-700">{data.companyName} 양식</p>
        <h1 className={`${pageTitle} break-keep`}>{data.form.title}</h1>
        {data.form.intro && <p className={`${pageDesc} mt-0!`}>{data.form.intro}</p>}
        <p className={caption}>초록 칸은 배분 기록으로 이미 채웠어요. 빈칸만 써 주세요</p>
      </header>

      <div className={card}>
        {data.form.fields.map((f) => {
          const id = `rf-${f.key}`;
          return (
            <div key={f.key} className="flex flex-col gap-1.5">
              <label htmlFor={id} className={label}>
                {f.label}
                {f.required && !f.auto && <span className="text-danger-fg"> *</span>}
              </label>
              {f.auto ? (
                <p className="rounded-xl bg-primary-50 px-4 py-3 text-[15px] font-bold text-primary-700">
                  {data.auto[f.auto] || "—"}
                </p>
              ) : f.kind === "long" ? (
                <textarea
                  id={id}
                  rows={4}
                  value={(values[f.key] as string) ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  maxLength={1000}
                  className={`${field} h-auto py-3`}
                />
              ) : f.kind === "photo" ? (
                <div className="flex flex-wrap gap-2">
                  {((values[f.key] as string[] | undefined) ?? []).map((src, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label="사진 빼기"
                      onClick={() =>
                        setValues({ ...values, [f.key]: (values[f.key] as string[]).filter((_, j) => j !== i) })
                      }
                      className="relative size-24 cursor-pointer overflow-hidden rounded-xl"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="size-full object-cover" />
                      <span className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-[12px] text-white">×</span>
                    </button>
                  ))}
                  {((values[f.key] as string[] | undefined) ?? []).length < MAX_PHOTOS && (
                    <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-neutral-300 text-[13px] font-bold text-neutral-500">
                      + 사진
                      <input
                        id={id}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => addPhotos(f.key, e.target.files)}
                      />
                    </label>
                  )}
                </div>
              ) : (
                <input
                  id={id}
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  value={(values[f.key] as string) ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  maxLength={100}
                  className={field}
                />
              )}
              {f.hint && !f.auto && <p className={caption}>{f.hint}</p>}
            </div>
          );
        })}
        <AdminCodeField {...admin.field} />
      </div>

      {error && <p className="text-[13px] text-danger-fg">{error}</p>}
      <button type="button" disabled={status === "saving" || !admin.codeReady} onClick={submit} className={btnPrimary}>
        {status === "saving" ? "보내는 중" : `${data.companyName}에 결과 문서 보내기`}
      </button>
    </div>
  );
}
