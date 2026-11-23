"use client";

import { formatQty } from "@/lib/rules";
import Link from "next/link";
import { useState } from "react";
import { formatKoreanDate } from "@/lib/rules";
import type { CompanyHistory } from "@/lib/company";
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
  const [mode, setMode] = useState<"person" | "company">("person");
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <header className="text-center">
        <h1 className={pageTitle}>신청 조회</h1>
        <p className={pageDesc}>
          {mode === "person"
            ? "신청할 때 쓴 전화번호로 지금까지 낸 신청을 확인해요"
            : "기업 관리 코드로 맡긴 물품이 어디까지 갔는지 확인해요"}
        </p>
      </header>
      <div className="flex gap-1.5" role="tablist" aria-label="조회 방법">
        {(
          [
            ["person", "개인 · 전화번호"],
            ["company", "기업 · 관리 코드"],
          ] as const
        ).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={
              "h-10 flex-1 cursor-pointer rounded-full border text-[14px] font-bold " +
              (mode === key
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-500")
            }
          >
            {text}
          </button>
        ))}
      </div>
      {mode === "person" ? <PersonLookup /> : <CompanyLookup />}
    </div>
  );
}

function PersonLookup() {
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
    <div className="flex flex-col gap-5">
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

type CompanyResult = {
  company: { name: string; manager: string; contact: string };
  history: CompanyHistory;
};

const INTAKE_LABEL = { pending: "배분기관 확인 대기", stored: "보관·배분 중", rejected: "배분기관이 받지 않음" } as const;

/** 배분기관에 맡긴 한 건의 한 줄 상태. 다 나눴으면 배분 완료로 본다. */
function intakeLine(i: CompanyHistory[number]["intakes"][number]) {
  if (i.status === "stored" && i.remainingQty === 0) return { tone: "ok" as const, text: "배분 완료" };
  if (i.status === "stored") return { tone: "ok" as const, text: INTAKE_LABEL.stored };
  if (i.status === "rejected") return { tone: "blocked" as const, text: INTAKE_LABEL.rejected };
  return { tone: "caution" as const, text: INTAKE_LABEL.pending };
}

/**
 * 기업 관리 코드 조회. 전화번호 조회처럼 "코드를 아는 것"이 자격이다. 코드는 8자라
 * 맞혀 볼 수 없고, 서버는 해시만 가지고 있다.
 */
function CompanyLookup() {
  const [code, setCode] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "notfound" | "error">("idle");
  const [result, setResult] = useState<CompanyResult | null>(null);

  async function handleSearch() {
    if (!code.trim()) return;
    setState("loading");
    const res = await fetch("/api/companies/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    }).catch(() => null);
    if (res?.status === 404) return setState("notfound");
    if (!res?.ok) return setState("error");
    setResult(await res.json());
    setState("done");
  }

  const totals = result?.history.reduce(
    (acc, h) => {
      acc.items += h.donation.quantity;
      for (const i of h.intakes) {
        acc.delivered += i.allocatedQty;
        acc.facilities += i.facilityCount;
      }
      for (const a of h.applications) if (a.status === "accepted") acc.delivered += a.quantity;
      return acc;
    },
    { items: 0, delivered: 0, facilities: 0 },
  );

  return (
    <div className="flex flex-col gap-5">
      <div className={card}>
        <label className={label}>기업 관리 코드</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="ABCD-2345"
          maxLength={9}
          className={`${field} font-mono tracking-wider`}
        />
        <button onClick={handleSearch} disabled={!code.trim() || state === "loading"} className={btnPrimary}>
          {state === "loading" ? "조회 중..." : "조회하기"}
        </button>
        {state === "notfound" && <p className="text-[13px] text-danger-fg">이 관리 코드로 등록된 기업이 없어요</p>}
        {state === "error" && <p className="text-[13px] text-danger-fg">연결에 문제가 있어요. 다시 시도해주세요</p>}
        <p className={caption}>
          관리 코드는 기업으로 처음 기부할 때 받아요.{" "}
          <Link href="/donate?donor=company" className="font-bold text-primary-700 underline underline-offset-2">
            기업 등록
          </Link>
        </p>
      </div>

      {state === "done" && result && totals && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-[20px] font-extrabold text-neutral-900">{result.company.name}</p>
            {result.company.manager && <p className={caption}>담당 {result.company.manager}</p>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [`${result.history.length}건`, "기부"],
              [`${totals.delivered}개`, "시설에 전달"],
              [`${totals.facilities}곳`, "받은 시설"],
            ].map(([v, k]) => (
              <div key={k} className="rounded-2xl bg-white px-3 py-3 text-center">
                <p className="text-[18px] font-extrabold text-neutral-900">{v}</p>
                <p className="text-xs font-bold text-neutral-500">{k}</p>
              </div>
            ))}
          </div>

          {result.history.length === 0 && (
            <p className="py-6 text-center text-[15px] text-neutral-400">아직 이 코드로 등록한 기부가 없어요</p>
          )}

          <div className="flex flex-col gap-3">
            {result.history.map((h) => (
              <div key={h.donation.id} className={card}>
                <div className="flex items-start gap-3">
                  {h.donation.productImageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={h.donation.productImageUrl} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
                  )}
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold">
                      {h.donation.itemName} · {formatQty(h.donation.quantity, h.donation.packing)}
                    </p>
                    <p className={caption}>{formatKoreanDate(h.donation.createdAt.slice(0, 10))} 등록</p>
                  </div>
                </div>
                {h.intakes.map((i) => {
                  const line = intakeLine(i);
                  return (
                    <Link
                      key={i.id}
                      href={`/entrusted/${i.id}`}
                      className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 hover:bg-neutral-100"
                    >
                      <div className="min-w-0">
                        <p className="text-[14px] font-bold text-neutral-800">{i.hubName}에 맡김</p>
                        <p className={caption}>
                          {i.allocatedQty > 0
                            ? `${i.facilityCount}곳에 ${i.allocatedQty}개 배분 · 남은 ${i.remainingQty}개`
                            : i.status === "rejected" && i.rejectReason
                              ? i.rejectReason
                              : "결과 보고서 보기"}
                        </p>
                      </div>
                      <span className={toneBadge(line.tone)}>{line.text}</span>
                    </Link>
                  );
                })}
                {h.applications.map((a) => (
                  <Link
                    key={a.id}
                    href={`/complete/${a.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl bg-neutral-50 px-3 py-2.5 hover:bg-neutral-100"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-neutral-800">{a.beneficiaryName}에 직접 · {a.quantity}개</p>
                      {a.confirmedDate && (
                        <p className={caption}>
                          {formatKoreanDate(a.confirmedDate)} {a.confirmedSlot}
                        </p>
                      )}
                    </div>
                    <span className={toneBadge(STATUS_TONE[a.status])}>{STATUS_LABEL[a.status]}</span>
                  </Link>
                ))}
                {h.intakes.length === 0 && h.applications.length === 0 && (
                  <p className={caption}>아직 맡기거나 신청하지 않았어요</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
