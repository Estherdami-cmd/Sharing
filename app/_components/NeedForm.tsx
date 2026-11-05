"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, clampTargetQty } from "@/lib/rules";
import type { Beneficiary } from "@/lib/store";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import Loading from "./Loading";
import { BackLink, OrgMessage, orgHomePath } from "./OrgCommon";
import {
  btnGhost,
  btnOutline,
  btnPrimary,
  caption,
  card,
  field,
  label,
  pageDesc,
  pageTitle,
} from "../ui";

export default function NeedForm({ orgId }: { orgId: string }) {
  const admin = useAdminCode();
  const homePath = orgHomePath(orgId);
  const [org, setOrg] = useState<Beneficiary | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  // 타이핑 중에는 빈 칸을 허용해야 한다. 매 키 입력마다 1로 되돌리면 필드를 지울 수 없고,
  // 지운 자리에 강제로 들어간 1 뒤에 이어 쳐서 "50"이 "150"이 된다. 포커스가 빠질 때 다듬는다.
  const [targetQty, setTargetQty] = useState<number | "">(50);
  const targetQtyValue = targetQty === "" ? 1 : targetQty;
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ itemName: string; targetQty: number } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/needs")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { beneficiaries: Beneficiary[] }) => {
        setOrg(data.beneficiaries.find((fb) => fb.id === orgId) ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("failed"));
  }, [orgId]);

  function handleImageSelected(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("이미지 파일만 올릴 수 있어요");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.onerror = () => setImageError("사진을 읽지 못했어요");
    reader.readAsDataURL(file);
  }

  function handleClearImage() {
    setImageUrl(null);
    setImageError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  async function handleSubmit() {
    setFormError(null);
    if (!itemName.trim()) {
      setFormError("품목명을 입력해주세요");
      return;
    }
    setSubmitting(true);
    const res = await admin
      .adminFetch(
        "/api/needs",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            beneficiaryId: orgId,
            itemName,
            category,
            targetQty: targetQtyValue,
            note,
            imageUrl,
          }),
        },
        handleSubmit,
      )
      .catch(() => null);
    setSubmitting(false);
    if (res?.status === 401) return; // 코드 입력란으로 데려갔다. 넣으면 이어서 등록한다.
    if (!res?.ok) {
      // 서버가 이유를 구체적으로 적어 보내면(카테고리 오류, 이미지 용량 초과 등)
      // 그 문장을 그대로 쓴다 — 뭉뚱그린 안내로는 원인을 짐작할 수 없다.
      const body = await res?.json().catch(() => null);
      setFormError(body?.error ?? "등록에 실패했어요. 다시 시도해주세요");
      return;
    }
    const need = await res.json();
    setCreated({ itemName: need.itemName, targetQty: need.targetQty });
    window.scrollTo({ top: 0 });
  }

  function handleAddAnother() {
    setCreated(null);
    setItemName("");
    setTargetQty(50);
    setNote("");
    handleClearImage();
  }

  if (status === "loading") return <Loading label="기관 정보" size="lg" overlay />;
  if (status === "failed" || !org) {
    return (
      <OrgMessage
        title={status === "failed" ? "기관 정보를 불러오지 못했어요" : "기관을 찾을 수 없어요"}
        href="/beneficiary"
        linkLabel="기관 선택으로 돌아가기"
      />
    );
  }

  if (created) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <BackLink href={homePath}>기관 홈</BackLink>
        <header aria-live="polite">
          <h1 className={pageTitle}>요청을 올렸어요</h1>
          <p className={pageDesc}>이제 기부자들이 나눠서 채울 수 있어요</p>
        </header>
        <section className={card}>
          <p className="break-keep text-[17px] font-bold tracking-[-0.02em]">{created.itemName}</p>
          <p className={caption}>
            {org.name} · 목표 {created.targetQty}개
          </p>
        </section>
        <div className="flex flex-col gap-2">
          <Link href={homePath} className={btnPrimary}>
            기관 홈으로
          </Link>
          <div className="flex gap-2">
            <button type="button" onClick={handleAddAnother} className={btnOutline}>
              하나 더 올리기
            </button>
            <Link href="/board" className={btnOutline}>
              진행 현황 보기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <BackLink href={homePath}>기관 홈</BackLink>
      <header>
        <h1 className={pageTitle}>필요 물품 올리기</h1>
        <p className={pageDesc}>목표 수량을 정하면 기부자들이 나눠서 채워요</p>
      </header>

      <div className={card}>
        <p className="rounded-xl bg-primary-50 px-3 py-2 text-[13px] text-primary-800">
          <b>{org.name}</b>의 요청으로 올라가요
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="need-item" className={label}>
            필요한 품목
          </label>
          <input
            id="need-item"
            placeholder="예: 성인용 기저귀 대형"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="need-category" className={label}>
            카테고리
          </label>
          <select
            id="need-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={field}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="need-target" className={label}>
            목표 수량
          </label>
          <input
            id="need-target"
            type="number"
            min={1}
            value={targetQty}
            onChange={(e) =>
              setTargetQty(e.target.value === "" ? "" : clampTargetQty(e.target.value))
            }
            onBlur={() => setTargetQty(targetQtyValue)}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="need-note" className={label}>
            안내 문구 (선택)
          </label>
          <input
            id="need-note"
            placeholder="예: 요양 어르신 12분께 매주 전달돼요"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={label}>대표 사진 (선택)</span>
          {imageUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={imageUrl}
                alt="등록할 물품 사진 미리보기"
                className="size-20 rounded-xl object-cover"
              />
              <button type="button" onClick={handleClearImage} className={btnGhost}>
                지우기
              </button>
            </div>
          ) : (
            /* btnOutline의 flex-1은 세로 배치 안에서 높이를 없앤다. 가로 줄로 감싼다. */
            <div className="flex">
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={btnOutline}
              >
                사진 선택
              </button>
            </div>
          )}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => handleImageSelected(e.target.files?.[0])}
            className="hidden"
          />
          {imageError && <p className="text-[13px] text-danger-fg">{imageError}</p>}
        </div>

        <p className={caption}>"도움이 필요해요" 표시는 진행률 30% 미만인 요청에 자동으로 붙어요</p>
      </div>

      <AdminCodeField {...admin.field} />

      {formError && <p className="text-[13px] text-danger-fg">{formError}</p>}

      <button type="button" onClick={handleSubmit} disabled={submitting} className={btnPrimary}>
        {submitting ? "등록 중..." : "필요 물품 등록"}
      </button>
    </div>
  );
}
