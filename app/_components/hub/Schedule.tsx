"use client";

import { useState } from "react";
import {
  type AllocationSchedule,
  DELIVERY_METHOD_LABEL,
  type DeliveryMethod,
  MAX_SCHEDULE_CANDIDATES,
  SCHEDULE_SLOTS,
  SCHEDULE_STATUS_BADGE,
  type ScheduleSlot,
  scheduleLabel,
} from "@/lib/hub";
import { addDays, startOfToday, toISODate } from "@/lib/rules";
import { field } from "../../ui";

/** 시간대·전달 방식처럼 몇 개 중 하나를 고르는 둥근 버튼 줄. */
function Pills<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={
            "h-9 flex-1 cursor-pointer rounded-full border px-2 text-[13px] font-bold whitespace-nowrap " +
            (value === key
              ? "border-neutral-900 bg-neutral-900 text-white"
              : "border-neutral-300 bg-white text-neutral-500")
          }
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** 날짜 + 시간대 한 줄. */
function SlotRow({
  value,
  onChange,
  onRemove,
}: {
  value: ScheduleSlot;
  onChange: (v: ScheduleSlot) => void;
  onRemove?: () => void;
}) {
  const min = toISODate(startOfToday());
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <input
          type="date"
          min={min}
          value={value.date}
          aria-label="날짜"
          onChange={(e) => onChange({ ...value, date: e.target.value })}
          className={`${field} min-w-0 flex-1`}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="이 후보 빼기"
            className="size-10 shrink-0 cursor-pointer rounded-xl border border-neutral-300 bg-white text-[16px] font-bold text-neutral-500"
          >
            ×
          </button>
        )}
      </div>
      <Pills
        ariaLabel="시간대"
        value={value.slot}
        options={SCHEDULE_SLOTS.map((s) => [s, s])}
        onChange={(slot) => onChange({ ...value, slot })}
      />
    </div>
  );
}

export function defaultCandidate(offsetDays = 1): ScheduleSlot {
  return { date: toISODate(addDays(startOfToday(), offsetDays)), slot: "오전" };
}

/** 배분기관이 전달 방식과 날짜 후보(최대 3개)를 고른다. 시설이 이 중 하나를 고른다. */
export function CandidatePicker({
  method,
  onMethodChange,
  candidates,
  onCandidatesChange,
}: {
  method: DeliveryMethod;
  onMethodChange: (m: DeliveryMethod) => void;
  candidates: ScheduleSlot[];
  onCandidatesChange: (c: ScheduleSlot[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Pills
        ariaLabel="전달 방식"
        value={method}
        options={[
          ["delivery", "가져다주기"],
          ["pickup", "시설이 가지러 오기"],
        ]}
        onChange={onMethodChange}
      />
      <div className="flex flex-col gap-2">
        {candidates.map((c, i) => (
          <SlotRow
            key={i}
            value={c}
            onChange={(v) => onCandidatesChange(candidates.map((x, j) => (j === i ? v : x)))}
            onRemove={candidates.length > 1 ? () => onCandidatesChange(candidates.filter((_, j) => j !== i)) : undefined}
          />
        ))}
      </div>
      {candidates.length < MAX_SCHEDULE_CANDIDATES && (
        <button
          type="button"
          onClick={() => onCandidatesChange([...candidates, defaultCandidate(candidates.length + 1)])}
          className="h-10 cursor-pointer rounded-xl border border-dashed border-neutral-400 bg-transparent text-[14px] font-bold text-neutral-600 hover:border-neutral-600"
        >
          + 날짜 후보 추가 (최대 {MAX_SCHEDULE_CANDIDATES}개)
        </button>
      )}
    </div>
  );
}

export function ScheduleBadge({ schedule }: { schedule: AllocationSchedule }) {
  const b = SCHEDULE_STATUS_BADGE[schedule.status];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${b.tone}`}>
      {b.label}
    </span>
  );
}

export type ScheduleActionBody =
  | { action: "confirm"; date: string; slot: string }
  | { action: "counter"; date: string; slot: string; note: string }
  | { action: "accept-counter" }
  | { action: "repropose"; method: DeliveryMethod; candidates: ScheduleSlot[] }
  | { action: "delivered" };

/**
 * 배분 한 건의 일정 카드. 배분기관과 시설이 같은 카드를 보되, 지금 상태에서 자기가 할 일만 버튼으로 나온다.
 *   시설:     후보 고르기 · 다른 날짜 요청 · 받았어요
 *   배분기관: 요청 수락 · 후보 다시 보내기 · 전달 완료
 */
export function ScheduleCard({
  role,
  title,
  subtitle,
  imageUrl,
  schedule,
  onAction,
}: {
  role: "hub" | "facility";
  title: string;
  subtitle: string;
  imageUrl?: string | null;
  schedule: AllocationSchedule;
  /** 성공하면 null, 실패하면 카드 안에 띄울 문구. */
  onAction: (body: ScheduleActionBody) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"idle" | "counter" | "repropose">("idle");
  const [picked, setPicked] = useState<ScheduleSlot | null>(schedule.candidates[0] ?? null);
  const [counter, setCounter] = useState<ScheduleSlot>(schedule.candidates[0] ?? defaultCandidate());
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<DeliveryMethod>(schedule.method);
  const [candidates, setCandidates] = useState<ScheduleSlot[]>(
    schedule.counter ? [{ date: schedule.counter.date, slot: schedule.counter.slot }] : schedule.candidates,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(body: ScheduleActionBody) {
    setBusy(true);
    setError(null);
    const err = await onAction(body);
    setBusy(false);
    if (err) setError(err);
    else setMode("idle");
  }

  const { status } = schedule;
  const confirmed =
    schedule.confirmedDate && schedule.confirmedSlot
      ? scheduleLabel({ date: schedule.confirmedDate, slot: schedule.confirmedSlot })
      : null;
  const primaryBtn =
    "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl bg-primary-700 px-3 text-[14px] font-bold text-white hover:bg-primary-800 disabled:opacity-50";
  const outlineBtn =
    "inline-flex h-11 flex-1 cursor-pointer items-center justify-center rounded-xl border-2 border-neutral-300 bg-white px-3 text-[14px] font-bold text-neutral-700 hover:border-neutral-400 disabled:opacity-50";

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
      <div className="flex items-start gap-3">
        {imageUrl && (
          <img src={imageUrl} alt="" className="size-12 shrink-0 rounded-xl border border-neutral-200 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <p className="break-keep text-[15px] font-bold text-neutral-900">{title}</p>
          <p className="mt-0.5 break-keep text-[13px] text-neutral-500">{subtitle}</p>
        </div>
        <ScheduleBadge schedule={schedule} />
      </div>

      <p className="text-[13px] font-bold text-neutral-600">{DELIVERY_METHOD_LABEL[schedule.method]}</p>

      {/* 상태별 본문 */}
      {status === "proposed" &&
        (role === "facility" && mode === "idle" ? (
          <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="전달 날짜 후보">
            {schedule.candidates.map((c) => {
              const on = picked?.date === c.date && picked?.slot === c.slot;
              return (
                <button
                  key={`${c.date}-${c.slot}`}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(c)}
                  className={
                    "flex h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-left text-[14px] font-bold " +
                    (on ? "border-primary-500 bg-primary-50 text-primary-700" : "border-neutral-200 bg-white text-neutral-700")
                  }
                >
                  <span aria-hidden className={`size-3 rounded-full border-2 ${on ? "border-primary-600 bg-primary-600" : "border-neutral-300"}`} />
                  {scheduleLabel(c)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-600">
            보낸 후보: {schedule.candidates.map(scheduleLabel).join(" · ")}
            {role === "hub" && <><br />시설이 날짜를 고르면 확정돼요</>}
          </p>
        ))}

      {status === "countered" && schedule.counter && (
        <p className="rounded-xl bg-danger-bg/60 px-3 py-2 text-[13px] leading-relaxed text-danger-fg">
          {role === "hub" ? "시설이 다른 날짜를 요청했어요" : "다른 날짜를 요청했어요. 배분기관 답을 기다리는 중이에요"}
          <br />
          <strong>{scheduleLabel(schedule.counter)}</strong>
          {schedule.counter.note && ` · "${schedule.counter.note}"`}
        </p>
      )}

      {(status === "confirmed" || status === "delivered") && confirmed && (
        <p className="rounded-xl bg-primary-50 px-3 py-2 text-[14px] font-bold text-primary-700">
          {status === "delivered" ? "전달 완료 · " : "확정 · "}
          {confirmed}
        </p>
      )}

      {/* 입력 모드 */}
      {mode === "counter" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-bold text-neutral-700">받기 좋은 날짜</p>
          <SlotRow value={counter} onChange={setCounter} />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="한마디 (선택) 예: 오후 3시 이후면 좋아요"
            maxLength={100}
            className={field}
          />
        </div>
      )}
      {mode === "repropose" && (
        <CandidatePicker method={method} onMethodChange={setMethod} candidates={candidates} onCandidatesChange={setCandidates} />
      )}

      {error && <p className="text-[13px] text-danger-fg">{error}</p>}

      {/* 동작 */}
      {status !== "delivered" && (
        <div className="flex gap-2">
          {mode === "counter" ? (
            <>
              <button type="button" className={outlineBtn} onClick={() => setMode("idle")} disabled={busy}>
                취소
              </button>
              <button
                type="button"
                className={primaryBtn}
                disabled={busy}
                onClick={() => run({ action: "counter", ...counter, note })}
              >
                {busy ? "보내는 중" : "이 날짜로 요청"}
              </button>
            </>
          ) : mode === "repropose" ? (
            <>
              <button type="button" className={outlineBtn} onClick={() => setMode("idle")} disabled={busy}>
                취소
              </button>
              <button
                type="button"
                className={primaryBtn}
                disabled={busy}
                onClick={() => run({ action: "repropose", method, candidates })}
              >
                {busy ? "보내는 중" : "후보 보내기"}
              </button>
            </>
          ) : role === "facility" ? (
            <>
              <button type="button" className={outlineBtn} onClick={() => setMode("counter")} disabled={busy}>
                다른 날짜 요청
              </button>
              {status === "proposed" && (
                <button
                  type="button"
                  className={primaryBtn}
                  disabled={busy || !picked}
                  onClick={() => picked && run({ action: "confirm", ...picked })}
                >
                  {busy ? "확정 중" : "이 날짜로 확정"}
                </button>
              )}
              {status === "confirmed" && (
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => run({ action: "delivered" })}>
                  {busy ? "처리 중" : "받았어요"}
                </button>
              )}
            </>
          ) : (
            <>
              <button type="button" className={outlineBtn} onClick={() => setMode("repropose")} disabled={busy}>
                {status === "countered" ? "다른 후보 보내기" : "일정 바꾸기"}
              </button>
              {status === "countered" && (
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => run({ action: "accept-counter" })}>
                  {busy ? "처리 중" : "요청 날짜로 확정"}
                </button>
              )}
              {status === "confirmed" && (
                <button type="button" className={primaryBtn} disabled={busy} onClick={() => run({ action: "delivered" })}>
                  {busy ? "처리 중" : "전달 완료"}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </article>
  );
}

/** 일정 카드 목록을 상태별로 묶을 때 쓰는 순서와 제목. 역할마다 "내 차례"가 먼저 온다. */
export const GROUP_ORDER = {
  hub: [
    { status: "countered", title: "시설이 다른 날짜를 요청했어요" },
    { status: "confirmed", title: "다가오는 전달" },
    { status: "proposed", title: "시설이 날짜 고르는 중" },
    { status: "delivered", title: "전달 완료" },
  ],
  facility: [
    { status: "proposed", title: "날짜를 골라주세요" },
    { status: "confirmed", title: "다가오는 전달" },
    { status: "countered", title: "배분기관 답을 기다리는 중" },
    { status: "delivered", title: "받은 물품" },
  ],
} as const;

/** 확정 일정은 날짜 순, 나머지는 최근 순. */
export function sortForStatus<T extends { schedule: AllocationSchedule; at: string }>(status: string, rows: T[]): T[] {
  if (status === "confirmed")
    return [...rows].sort((a, b) => (a.schedule.confirmedDate ?? "").localeCompare(b.schedule.confirmedDate ?? ""));
  return [...rows].sort((a, b) => b.at.localeCompare(a.at));
}
