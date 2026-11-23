"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REGISTER_ORG_CATEGORIES } from "@/lib/hub";
import { REGIONS } from "@/lib/rules";
import { AdminCodeField, useAdminCode } from "./AdminCode";
import { BackLink, orgHomePath } from "./OrgCommon";
import { btnPrimary, caption, card, field, label, pageDesc, pageTitle } from "../ui";

type Kind = "facility" | "hub";

/**
 * 목록에 없는 기관을 직접 등록한다. 공공데이터에 없는 시설·배분기관(NGO 등)이 대상이다.
 * 등록하면 바로 그 기관 홈으로 들어가 필요한 물품을 올리거나 입고를 관리할 수 있다.
 */
export default function OrgRegister() {
  const router = useRouter();
  const admin = useAdminCode();
  const [kind, setKind] = useState<Kind>("facility");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(REGISTER_ORG_CATEGORIES.facility[0]);
  const [address, setAddress] = useState("");
  const [region, setRegion] = useState(REGIONS[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ text: string; existingId?: string } | null>(null);

  const ready = name.trim() && address.trim() && admin.codeReady && !busy;

  function pickKind(next: Kind) {
    setKind(next);
    setCategory(REGISTER_ORG_CATEGORIES[next][0]);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await admin.adminFetch(
      "/api/orgs",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, address, region }),
      },
      submit,
    );
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError({ text: body?.error ?? "등록하지 못했어요. 다시 시도해주세요", existingId: body?.existingId });
      setBusy(false);
      return;
    }
    const org = await res.json();
    router.push(orgHomePath(org.id));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <BackLink href="/beneficiary">기관 선택</BackLink>
      <header className="text-center">
        <h1 className={pageTitle}>기관 등록</h1>
        <p className={pageDesc}>목록에 없는 기관을 등록해요. 등록하면 바로 기관 홈으로 들어가요</p>
      </header>

      <div className={card}>
        <div className="flex flex-col gap-1.5">
          <p className={label}>어떤 기관인가요?</p>
          <div className="flex gap-2" role="radiogroup" aria-label="기관 유형">
            {(
              [
                ["facility", "시설", "필요한 물품을 올리고 받아요"],
                ["hub", "배분기관", "받은 물품을 여러 시설에 나눠요"],
              ] as const
            ).map(([key, text, sub]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={kind === key}
                onClick={() => pickKind(key)}
                className={
                  "flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-3 transition-colors " +
                  (kind === key
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-neutral-300 bg-white text-neutral-500 hover:border-neutral-400")
                }
              >
                <span className="text-[15px] font-bold">{text}</span>
                <span className="text-[12px] font-medium">{sub}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-category" className={label}>
            종류
          </label>
          <select id="org-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field}>
            {REGISTER_ORG_CATEGORIES[kind].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-name" className={label}>
            기관 이름
          </label>
          <input
            id="org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="예: 햇살 지역아동센터"
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-address" className={label}>
            주소
          </label>
          <input
            id="org-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            maxLength={100}
            placeholder="예: 포항시 북구 ○○로 12"
            className={field}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="org-region" className={label}>
            가까운 동네
          </label>
          <select id="org-region" value={region} onChange={(e) => setRegion(e.target.value)} className={field}>
            {REGIONS.map((r) => (
              <option key={r.name} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
          <p className={caption}>기부자에게 가까운 기관을 추천할 때 이 동네를 기준으로 거리를 재요</p>
        </div>

        <AdminCodeField {...admin.field} />

        {error && (
          <p className="text-[13px] text-danger-fg">
            {error.text}
            {error.existingId && (
              <>
                {" "}
                <Link href={orgHomePath(error.existingId)} className="font-bold underline underline-offset-2">
                  그 기관으로 가기
                </Link>
              </>
            )}
          </p>
        )}
      </div>

      <button type="button" disabled={!ready} onClick={submit} className={btnPrimary}>
        {busy ? "등록하는 중" : admin.codeState === "needed" ? "관리 코드를 먼저 확인해주세요" : "등록하고 들어가기"}
      </button>
    </div>
  );
}
