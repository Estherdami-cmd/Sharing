"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { checkHubCriteria } from "@/lib/hub";
import { CATEGORIES } from "@/lib/rules";
import { useAdminCode } from "../AdminCode";
import { btnPrimary, caption, card, field, label } from "../../ui";
import { CriteriaList, HubFrame, hubPath, useHubOverview } from "./HubCommon";

type Row = { itemName: string; category: string; quantity: number; expiryDate: string };

const EMPTY_ROW: Row = { itemName: "", category: "음료", quantity: 1, expiryDate: "" };

/** Firestore 문서에 그대로 넣으므로 긴 변을 1024px로 줄인 JPEG로 만든다. */
async function toSmallDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.8);
}

/**
 * 입고 직접 촬영. 배분기관에 물품이 바로 들어왔을 때(현장 기부·차량 하차) 사진을 찍어
 * 그 자리에서 보관으로 올린다. 실물을 이미 받았으니 입고 대기를 거치지 않는다.
 *
 * 사진 AI는 기부자 화면과 같은 판독(/api/recognize)을 그대로 쓴다. 지금 판독은 한 번에
 * 한 품목만 읽으므로 첫 줄을 채우고, 한 장에 같이 찍힌 다른 품목은 줄을 더해 적는다.
 */
export default function WalkinIntake({ hubId }: { hubId: string }) {
  const router = useRouter();
  const admin = useAdminCode();
  const { data } = useHubOverview(hubId);
  const fileRef = useRef<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([{ ...EMPTY_ROW }]);
  const [donorName, setDonorName] = useState("");
  const [reading, setReading] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    fileRef.current = file;
    setPreview(await toSmallDataUrl(file));
    setAiNote(null);
  }

  async function readWithAi() {
    if (!fileRef.current) return;
    setReading(true);
    setAiNote(null);
    const form = new FormData();
    form.append("image", fileRef.current);
    const res = await fetch("/api/recognize", { method: "POST", body: form }).catch(() => null);
    setReading(false);
    const body = await res?.json().catch(() => null);
    if (!res?.ok || !body) {
      setAiNote(body?.error ?? "사진을 읽지 못했어요. 직접 입력해주세요");
      return;
    }
    update(0, {
      itemName: body.itemName ?? "",
      category: CATEGORIES.includes(body.category) ? body.category : "기타",
      expiryDate: body.expiryDate ?? "",
    });
    setAiNote(
      body.source === "openai"
        ? "AI가 읽은 값이에요. 수량과 함께 같이 찍힌 다른 품목은 직접 더해주세요"
        : "AI 서버에 연결하지 못해 예시 값이 들어갔어요. 실제 값으로 고쳐주세요",
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const items = rows
      .filter((r) => r.itemName.trim())
      .map((r) => ({ ...r, expiryDate: r.expiryDate || null, donorName }));
    const res = await admin.adminFetch(
      "/api/intakes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walkin: true, hubId, items, imageUrl: preview }),
      },
      submit,
    );
    setBusy(false);
    if (res.status === 401) return;
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "등록하지 못했어요");
      return;
    }
    router.push(`${hubPath(hubId)}/storage`);
  }

  const filled = rows.filter((r) => r.itemName.trim());

  return (
    <HubFrame hubId={hubId} hubCategory={data?.hub.category} hubName={data?.hub.name ?? ""} admin={admin}>
      <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
        <h2 className="text-[20px] font-bold tracking-[-0.02em]">입고 촬영</h2>

        <section className={card}>
          <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-[14px] font-bold text-neutral-500 hover:border-primary-500">
            {preview ? (
              <img src={preview} alt="입고 사진" className="max-h-72 w-full object-contain" />
            ) : (
              <>
                <span aria-hidden className="text-[28px]">📷</span>
                들어온 박스를 그 자리에서 찍어주세요
              </>
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {preview && (
            <button
              type="button"
              disabled={reading}
              onClick={readWithAi}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-primary-700 bg-white text-[14px] font-bold text-primary-700 hover:bg-primary-50 disabled:opacity-50"
            >
              <span className="rounded bg-primary-700 px-1.5 py-0.5 text-[11px] text-white">AI</span>
              {reading ? "읽는 중" : "사진에서 품목·기한 읽기"}
            </button>
          )}
          {aiNote && <p className="text-[13px] text-warning-fg">{aiNote}</p>}
        </section>

        {rows.map((row, i) => {
          const { checks } = checkHubCriteria({
            category: row.category,
            quantity: row.quantity,
            expiryDate: row.expiryDate || null,
          });
          return (
            <section key={i} className={card}>
              <div className="flex items-center justify-between">
                <span className={label}>품목 {i + 1}</span>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                    className="cursor-pointer border-none bg-transparent text-xs font-bold text-neutral-400 hover:text-danger-fg"
                  >
                    빼기
                  </button>
                )}
              </div>
              <input
                value={row.itemName}
                onChange={(e) => update(i, { itemName: e.target.value })}
                placeholder="품목명 (예: 생수 2L)"
                aria-label={`품목 ${i + 1} 이름`}
                className={field}
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={row.category}
                  onChange={(e) => update(i, { category: e.target.value })}
                  aria-label={`품목 ${i + 1} 분류`}
                  className={field}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={row.quantity}
                  onChange={(e) => update(i, { quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                  aria-label={`품목 ${i + 1} 수량`}
                  className={field}
                />
              </div>
              <input
                type="date"
                value={row.expiryDate}
                onChange={(e) => update(i, { expiryDate: e.target.value })}
                aria-label={`품목 ${i + 1} 소비기한`}
                className={field}
              />
              {row.itemName.trim() && <CriteriaList checks={checks} />}
            </section>
          );
        })}

        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
          className="h-11 cursor-pointer rounded-xl border-2 border-dashed border-neutral-300 bg-transparent text-[14px] font-bold text-neutral-500 hover:border-neutral-400"
        >
          + 같이 들어온 품목 더하기
        </button>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="walkin-donor" className={label}>
            보낸 곳 (선택)
          </label>
          <input
            id="walkin-donor"
            value={donorName}
            onChange={(e) => setDonorName(e.target.value)}
            placeholder="예: ○○마트"
            className={field}
          />
        </div>

        {error && <p className="text-[14px] text-danger-fg">{error}</p>}
        <button type="button" disabled={busy || filled.length === 0} onClick={submit} className={btnPrimary}>
          {busy ? "등록 중" : `입고 등록 · 보관으로 (${filled.length}개 품목)`}
        </button>
        <p className={`${caption} text-center`}>등록하면 장부에 입고로 자동 기록돼요</p>
      </div>
    </HubFrame>
  );
}
