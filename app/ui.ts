/**
 * 공용 클래스 토큰. DESIGN_GUIDE.md의 4장(Layout Components)을 코드로 옮긴 것.
 * 컴포넌트마다 긴 className을 반복하지 않기 위해 여기 모아둔다.
 */

export type Tone = "ok" | "caution" | "blocked";

export const TONE_LABEL: Record<Tone, string> = {
  ok: "나눔 가능",
  caution: "나눔 주의",
  blocked: "나눔 불가",
};

const BADGE_BASE = "inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap";

const TONE_BADGE: Record<Tone, string> = {
  ok: "bg-success-bg text-success-fg",
  caution: "bg-warning-bg text-warning-fg",
  blocked: "bg-danger-bg text-danger-fg",
};

export function toneBadge(tone: Tone) {
  return `${BADGE_BASE} ${TONE_BADGE[tone]}`;
}

export const rankBadge = `${BADGE_BASE} bg-primary-100 text-primary-700`;

/** 판정 사유 텍스트. 뱃지와 같은 색 계열로 맞춰 한 덩어리로 읽히게 한다. */
export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-success-fg",
  caution: "text-warning-fg",
  blocked: "text-danger-fg",
};

export const card = "bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3";
export const cardHighlight = "bg-white border-2 border-primary-500 rounded-2xl p-5 flex flex-col gap-3";
export const cardUrgent = "bg-white border-2 border-warning-fg/40 rounded-2xl p-5 flex flex-col gap-3";

export const label = "text-xs font-bold text-neutral-700";
export const caption = "text-[13px] text-neutral-500 leading-relaxed";

export const field =
  "w-full h-12 px-4 rounded-xl border border-neutral-300 bg-white text-[15px] text-neutral-900 " +
  "outline-none transition-colors focus:border-primary-500 focus:ring-4 focus:ring-primary-100";

const BTN_BASE =
  "inline-flex items-center justify-center rounded-xl font-bold transition-all active:scale-[0.98] " +
  "disabled:cursor-not-allowed disabled:active:scale-100";

/** 화면의 핵심 행동. 라벤더는 밝아서 700을 써야 흰 글씨가 읽힌다. */
export const btnPrimary = `${BTN_BASE} h-14 md:h-13 w-full bg-primary-700 text-white text-[15px] hover:bg-primary-800 disabled:bg-neutral-100 disabled:text-neutral-400`;

/** 단계 이동. 토스의 검정 버튼. */
export const btnSecondary = `${BTN_BASE} h-14 md:h-13 w-full bg-neutral-900 text-white text-[15px] hover:bg-neutral-800 disabled:bg-neutral-100 disabled:text-neutral-400`;

export const btnOutline = `${BTN_BASE} h-12 flex-1 bg-white border-2 border-neutral-300 text-neutral-700 text-[14px] hover:border-neutral-400`;

export const btnDanger = `${BTN_BASE} h-12 flex-1 bg-white border-2 border-danger-fg/40 text-danger-fg text-[14px] hover:bg-danger-bg`;

export const btnGhost =
  "text-[13px] text-neutral-400 hover:text-neutral-600 transition-colors bg-transparent border-none cursor-pointer";

/** 요일 칩. primary-500 위에는 흰 글씨가 안 읽혀서 neutral-900을 얹는다. */
export function chip(active: boolean) {
  return (
    "flex-1 h-10 rounded-full text-[13px] font-bold transition-colors cursor-pointer border " +
    (active
      ? "bg-primary-500 border-primary-500 text-neutral-900"
      : "bg-white border-neutral-300 text-neutral-500 hover:border-neutral-400")
  );
}

/** 페이지 컨테이너. 모바일 우선으로 짜고 넓은 화면에서 넓히기만 한다. */
export const shell = "w-full max-w-full md:max-w-2xl lg:max-w-3xl xl:max-w-5xl flex flex-col items-stretch gap-6";

export const pageTitle = "text-2xl md:text-[28px] xl:text-[32px] font-extrabold tracking-[-0.03em] text-neutral-900";
export const pageDesc = "text-[15px] text-neutral-500 mt-2";
export const sectionTitle = "text-[17px] font-bold tracking-[-0.02em] text-neutral-900";
