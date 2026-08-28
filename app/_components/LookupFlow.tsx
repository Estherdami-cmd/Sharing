"use client";

import Link from "next/link";
import { useState } from "react";
import { formatKoreanDate } from "@/lib/rules";
import type { ApplicationDetail } from "@/lib/store";
import {
  btnPrimary,
  caption,
  card,
  field,
  label,
  pageDesc,
  pageTitle,
  toneBadge,
} from "../ui";

const STATUS_TONE = {
  pending: "caution",
  accepted: "ok",
  rejected: "blocked",
} as const;

const STATUS_LABEL: Record<ApplicationDetail["status"], string> = {
  pending: "기관 확인 대기중",
  accepted: "수락됨",
  rejected: "거절됨",
};

/**
 * 회원 가입이 없는 서비스라, "신청할 때 쓴 전화번호를 아는 것"이 본인 확인을
 * 대신한다. 진짜 인증은 아니라서 번호를 아는 다른 사람도 볼 수 있지만, 지금
 * 규모에서는 이 정도가 새 로그인 체계를 만드는 것보다 현실적인 선택이다.
 */
export default function LookupFlow() {
  const [contact, setContact] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [results, setResults] = useState<ApplicationDetail[]>([]);

  async function handleSearch() {
    const digits = contact.replace(/\D/g, "");
    if (!digits) return;
    setState("loading");
    try {
      const res = await fetch(`/api/applications?contact=${digits}`);
      if (!res.ok) throw new Error("failed");
      setResults(await res.json());
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>내 신청 조회</h1>
        <p className={pageDesc}>
          신청할 때 쓴 전화번호로 지금까지 낸 신청을 확인해요
        </p>
      </header>

      <div className={card}>
        <label className={label}>전화번호</label>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            value={contact}
            onChange={(e) => setContact(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="01012345678"
            className={`${field} flex-1`}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={!contact || state === "loading"}
          className={btnPrimary}
        >
          {state === "loading" ? "조회 중..." : "조회하기"}
        </button>
        {state === "error" && (
          <p className="text-[13px] text-danger-fg">
            연결에 문제가 있어요. 다시 시도해주세요
          </p>
        )}
      </div>

      {state === "done" && results.length === 0 && (
        <p className="py-6 text-center text-[15px] text-neutral-400">
          이 번호로 낸 신청이 없어요
        </p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((app) => (
            <Link
              key={app.id}
              href={`/complete/${app.id}`}
              className={`${card} cursor-pointer hover:border-primary-300`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">
                    {app.beneficiary.name}
                  </p>
                  <p className="mt-0.5 text-[13px] text-neutral-600">
                    {app.donation.itemName} · {app.quantity}개
                  </p>
                  {app.confirmedDate ? (
                    <p className="mt-1 text-[13px] font-semibold text-success-fg">
                      {formatKoreanDate(app.confirmedDate)} {app.confirmedSlot}
                    </p>
                  ) : (
                    <p className={`mt-1 ${caption}`}>
                      {app.candidateDates
                        .map((c) => formatKoreanDate(c.date))
                        .join(" · ")}{" "}
                      중 조율
                    </p>
                  )}
                </div>
                <span className={toneBadge(STATUS_TONE[app.status])}>
                  {STATUS_LABEL[app.status]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
