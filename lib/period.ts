/**
 * 요청의 "모집 기간" 문구. 홈 카드, 게시판, 추천(매칭), 기관 화면이 같이 쓴다.
 * 서버 코드(store.ts)를 끌어오지 않도록 이 파일은 아무것도 import하지 않는다.
 */

type PeriodSource = { id: string; createdAt: string; deadline?: string | null };

/**
 * [데모용 스위치] true면 마감일이 없는 기존 요청에 임시 모집 기간을 만들어 보여주고,
 * 게시판의 "○일 전"도 그 임시 시작일 기준으로 맞춘다.
 * false로 바꾸면 전부 원래대로 돌아간다 — 실제 등록일(createdAt)로 "○일 전"을 보여주고,
 * 마감일이 없는 요청에는 모집 기간을 표시하지 않는다.
 * Firebase의 실제 데이터(등록일 등)는 어느 쪽이든 바뀌지 않는다. 화면 표시만 다르다.
 */
export const USE_DEMO_PERIOD = true;

/** "YYYY-MM-DD…" → "11/5". 마감일은 날짜 문자열이라 시간대 변환 없이 바로 자른다. */
function shortDate(value: string) {
  const [, m, d] = value.slice(0, 10).split("-").map(Number);
  return `${m}/${d}`;
}

/**
 * [데모용] 마감일 기능 전에 등록된 요청(deadline이 null)에 보여줄 임시 모집 기간.
 * 실제 데이터(Firebase)는 건드리지 않고 화면에서만 채운다. 기존 요청은 전부 같은 날
 * 씨드로 들어가 등록일이 너무 예전이라, 시작일도 9/25~10/15 사이로 바꿔 보여준다.
 * 마감일은 오늘부터 7~46일 뒤라 발표 날에도 "끝난 모집"으로 보이지 않는다.
 * 요청 id로 날짜를 골라서 카드마다 조금씩 다르고, 새로고침해도 바뀌지 않는다.
 * 발표가 끝나면 위의 USE_DEMO_PERIOD를 false로 바꾸면 원래대로 돌아간다.
 */
function demoPeriod(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const start = new Date(2026, 8, 25); // 9월 25일 (월은 0부터)
  start.setDate(start.getDate() + ((hash >>> 8) % 21));
  const end = new Date();
  end.setDate(end.getDate() + 7 + (hash % 40));
  return {
    start: start.toLocaleDateString("sv-SE"),
    end: end.toLocaleDateString("sv-SE"),
  };
}

/**
 * 화면에 보여줄 등록일(ISO 문자열). "○일 전"과 "최신 등록순" 정렬이 이 값을 쓴다.
 * 데모 스위치가 켜져 있고 마감일이 없는 기존 요청이면 임시 시작일을, 아니면 실제 등록일을 준다.
 */
export function displayCreatedAt(need: PeriodSource) {
  if (USE_DEMO_PERIOD && !need.deadline) {
    return new Date(`${demoPeriod(need.id).start}T09:00:00+09:00`).toISOString();
  }
  return need.createdAt;
}

/**
 * 카드에 그대로 넣는 "모집 기간 11/5 ~ 12/5" 문구.
 * 마감일이 없고 데모 스위치도 꺼져 있으면 null — 그때는 기간 줄을 그리지 않는다.
 */
export function needPeriodLabel(need: PeriodSource) {
  if (need.deadline) {
    const start = new Date(need.createdAt).toLocaleDateString("sv-SE");
    return `모집 기간 ${shortDate(start)} ~ ${shortDate(need.deadline)}`;
  }
  if (!USE_DEMO_PERIOD) return null;
  const demo = demoPeriod(need.id);
  return `모집 기간 ${shortDate(demo.start)} ~ ${shortDate(demo.end)}`;
}
