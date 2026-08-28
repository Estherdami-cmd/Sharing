/*
 * 비동기 로딩 화면.
 *
 * 예전에는 "불러오는 중..." 한 줄을 세 페이지(board·donate·apply)에 각자 적어
 * 뒀다. 문구가 조금씩 갈릴 위험이 있었고, 무엇보다 글자만 있으면 화면이 멈춘
 * 것처럼 보였다. 여기 한 군데로 모은다.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 스피너
 *
 * 브랜드 일러스트(사람·새·사슴·물고기·새싹…)가 고리 모양으로 둘러선 그림을
 * 그대로 회전시킨다. 별도 스피너 그래픽을 만들지 않아도 되고, 로딩 중에도
 * "여럿이 둘러서서 나눈다"는 서비스 얘기를 한 번 더 한다.
 *
 * 회전이 흔들리지 않는 건 그림 덕이다 — 내용의 무게중심(229.4, 234.0)이
 * viewBox 중심(229.5, 234.0)과 0.1px 차이로 맞아서, 별도 보정 없이 제자리에서
 * 돈다. 그림을 교체할 땐 이 중심이 맞는지 먼저 재야 한다.
 *
 * 다른 에셋으로 바꾸려면 SPINNER_SRC만 고치면 된다. null로 두면 아래 CSS 링
 * 스피너로 돌아간다.
 * ────────────────────────────────────────────────────────────────────────────
 */
const SPINNER_SRC: string | null = "/loading-spinner.svg";

/*
 * 스피너 지름. 화면 전체용(lg)과 영역용(md)을 나눈다.
 *
 * CSS 링이었을 땐 32/48px로 충분했지만, 일러스트는 그 안에 도형이 여러 개
 * 들어가서 작으면 뭉개진다. 형체가 구분되는 크기까지 올렸다.
 */
const SIZE = {
  md: "size-16",
  lg: "size-24",
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
  /**
   * 페이지가 처음 뜨는 중일 때. 화면을 덮고 정중앙에 스피너를 놓는다.
   *
   * 반쪽만 채워진 화면(제목·통계는 떴는데 목록은 비어 있는 상태)을 보여주면
   * 뭐가 아직 오는 중인지 알 수 없어 고장처럼 보인다. 다 오기 전까지는 한
   * 군데만 보게 한다.
   *
   * 이미 내용이 떠 있는데 배경에서 갱신하는 경우에는 쓰지 않는다 — 보고 있던
   * 화면을 덮어버리면 그게 더 방해다.
   */
  overlay?: boolean;
  /** 화면을 덮지 않되 세로 여백을 넉넉히 줄 때. */
  fullPage?: boolean;
};

export default function Loading({
  label = "내용",
  size = "md",
  overlay = false,
  fullPage = false,
}: Props) {
  const message = `${label}${objectParticle(label)} 불러오고 있어요`;

  /*
    z-40은 헤더(z-50) 바로 아래다. 헤더를 덮지 않아서 로딩 중에도 로고와 메뉴가
    남고, 사용자는 자기가 어느 서비스 어디에 있는지 놓치지 않는다.

    pt-16은 그 헤더 높이(h-16)만큼이다. inset-0 기준으로 정중앙에 두면 헤더에
    가린 만큼 위로 치우쳐 보이므로, 헤더를 뺀 영역의 가운데로 맞춘다.

    배경은 body와 같은 neutral-50 불투명으로 깐다. 반투명으로 두면 뒤에 반쯤
    그려진 화면이 비쳐서 덮는 목적이 사라진다.
  */
  const shell = overlay
    ? "fixed inset-0 z-40 bg-neutral-50 pt-16"
    : fullPage
      ? "min-h-[50vh] py-16"
      : "py-10";

  return (
    /*
      role="status" + aria-live="polite"로 스크린리더에 로딩 시작을 알린다.
      aria-busy는 이 영역이 아직 확정되지 않았다는 뜻이다.
    */
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`flex flex-col items-center justify-center gap-3 ${shell}`}
    >
      {SPINNER_SRC ? (
        /*
          animate-spin 기본 속도는 1초인데, 도형이 여러 개 든 그림에는 너무
          빨라 형체가 뭉개지고 조급해 보였다. 2.5초로 늦춰 도형이 알아볼 만한
          속도로 돈다.

          animate-spin은 prefers-reduced-motion을 스스로 존중하지 않는다.
          motion-reduce:animate-none으로 끊는다 — 그래도 그림은 남아서 로딩
          중이라는 걸 보여주고, 아래 글자가 상태를 말한다.

          alt=""로 두는 건 의도한 것이다. 바깥 role="status"가 아래 글자를
          읽어주므로, 그림까지 읽으면 같은 말이 두 번 나온다.
        */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={SPINNER_SRC}
          alt=""
          aria-hidden
          className={`${SIZE[size]} shrink-0 animate-spin [animation-duration:2.5s] motion-reduce:animate-none`}
        />
      ) : (
        /*
          SPINNER_SRC가 null일 때 쓰는 폴백. 링의 한 조각만 진한 색으로 남기고
          회전시킨다. border-t만 칠하면 12시 방향 한 점만 돌아 얇아 보여서,
          인접한 두 변을 칠해 호(弧)로 만든다. 단색 도형이라 기본 1초 속도가
          그대로 어울린다.

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
