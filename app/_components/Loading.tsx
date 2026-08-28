/*
 * 비동기 로딩 화면.
 *
 * 예전에는 "불러오는 중..." 한 줄을 세 페이지(board·donate·apply)에 각자 적어
 * 뒀다. 문구가 조금씩 갈릴 위험이 있었고, 무엇보다 글자만 있으면 화면이 멈춘
 * 것처럼 보였다. 여기 한 군데로 모은다.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 스피너 에셋 교체 지점
 *
 * 지금은 아래 CSS 링 스피너를 쓴다. 에셋(GIF·Lottie·SVG)을 받으면 SPINNER_SRC에
 * 경로만 넣으면 된다 — 그러면 이미지 스피너로 자동 전환된다. 나머지 레이아웃·
 * 접근성 처리는 그대로 재사용된다.
 *
 *   const SPINNER_SRC = "/spinner.gif";
 * ────────────────────────────────────────────────────────────────────────────
 */
const SPINNER_SRC: string | null = null;

/** 스피너 지름. 화면 전체용(lg)과 영역용(md)을 나눈다. */
const SIZE = {
  md: "size-8",
  lg: "size-12",
} as const;

/*
 * 목적격 조사는 받침에 따라 갈린다 — "목록을"이지만 "신청서를"이다. 한쪽으로
 * 고정하면 label을 바꿀 때마다 어색한 문장이 나온다.
 *
 * 한글 음절은 유니코드에서 (초성 × 21 × 28) 순으로 배열되어 있어서, 0xAC00을
 * 뺀 값을 28로 나눈 나머지가 종성 번호다. 0이면 받침이 없다.
 */
function objectParticle(word: string): "을" | "를" {
  const last = word.trim().at(-1);
  if (!last) return "를";
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return "를"; // 한글 음절이 아니면 기본값
  return (code - 0xac00) % 28 === 0 ? "를" : "을";
}

type Props = {
  /** 로딩 중인 대상. "목록", "신청서"처럼 명사로 넣는다. */
  label?: string;
  size?: keyof typeof SIZE;
  /** 페이지 전체를 채울 때. 세로 여백을 더 준다. */
  fullPage?: boolean;
};

export default function Loading({ label = "내용", size = "md", fullPage = false }: Props) {
  const message = `${label}${objectParticle(label)} 불러오고 있어요`;

  return (
    /*
      role="status" + aria-live="polite"로 스크린리더에 로딩 시작을 알린다.
      aria-busy는 이 영역이 아직 확정되지 않았다는 뜻이다.
    */
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-3 ${
        fullPage ? "min-h-[50vh] py-16" : "py-10"
      }`}
    >
      {SPINNER_SRC ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={SPINNER_SRC} alt="" aria-hidden className={SIZE[size]} />
      ) : (
        /*
          링의 한 조각만 진한 색으로 남기고 회전시킨다. border-t만 칠하면 12시
          방향 한 점만 돌아 얇아 보여서, 인접한 두 변을 칠해 호(弧)로 만든다.

          animate-spin은 prefers-reduced-motion을 스스로 존중하지 않는다.
          motion-reduce:animate-none으로 끊고, 대신 아래 글자로 상태를 전한다.
        */
        <span
          aria-hidden
          className={`${SIZE[size]} shrink-0 animate-spin rounded-full border-[3px] border-neutral-200 border-t-primary-600 border-r-primary-600 motion-reduce:animate-none`}
        />
      )}

      <p className="break-keep text-center text-[15px] text-neutral-500">{message}</p>
    </div>
  );
}
