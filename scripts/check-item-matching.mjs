/**
 * 품목 유사도 판정 회귀 검사.
 *
 * 러너 없이 node로 바로 돈다 — `npm run check:items`.
 * lib/rules.ts를 tsc로 컴파일한 결과를 불러 실제 함수를 그대로 검사한다.
 *
 * 이 로직은 손대면 조용히 깨진다. 특히 포함 관계 규칙이 그렇다 — "쌀"을 한 글자로
 * 허용하면 "찹쌀"이 "쌀"을 포함해 같은 물건이 되고, 두 글자까지 막으면 "우유"와
 * "흰 우유"를 놓친다. 그 경계를 아래 케이스가 지킨다.
 */
import { writeFileSync } from "node:fs";

// tsc가 뱉은 .js를 node가 CommonJS로 읽으려다 경고를 낸다. ESM이라고 알려준다.
writeFileSync(new URL("../.tmp-check/package.json", import.meta.url), '{"type":"module"}');
const { isSameItem, isSameItemBy, canonicalItemName } = await import("../.tmp-check/rules.js");

/** [기부 품목, 요청 품목, 같은 물건인가] */
const CASES = [
  // 용량만 다른 같은 물건
  ["백미 5kg", "백미 10kg", true],
  ["참치 통조림 200g", "참치 통조림 150g", true],
  ["수건", "수건 10장", true],
  ["흰 우유 1L", "우유 1L", true],
  // 동의어·상표명
  ["백미 5kg", "쌀 20kg", true],
  ["즉석밥 210g", "햇반 210g", true],
  ["3겹 화장지 30롤", "두루마리휴지 24롤", true],
  ["생리대 대형 20개입", "위생대 20개입", true],
  ["간장 1L", "진간장 1L", true],
  // 규격어 정규화
  ["공책 10권 세트", "공책 5권", true],
  ["라면 멀티팩 5개입", "라면 5개입", true],
  // 서로 다른 물건 — 뭉개지면 안 된다
  ["백미 5kg", "현미 2kg", false],
  ["백미 5kg", "찹쌀 3kg", false],
  ["찹쌀 3kg", "쌀 20kg", false],
  ["참치 통조림 200g", "스팸 200g", false],
  ["흰 우유 1L", "떠먹는 요구르트 8개입", false],
  ["공책 10권 세트", "색연필 24색 세트", false],
  ["아동용 겨울 점퍼 (110-130)", "성인용 내복 세트", false],
  ["된장 500g", "고추장 500g", false],
  // 동의어 표가 만든 실제 오탐 — 물티슈를 "물수건"으로 바꾸자 "수건"에 걸렸다
  ["물티슈 10팩", "수건", false],
  ["물티슈 10팩", "물티슈 5팩", true],
];

/**
 * 일반명은 품목명을 "대신"하지 않고 "더한다". 모델이 같은 물건에 다른 일반명을
 * 줘도(참치캔 / 참치통조림) 품목명 쪽으로 잡혀야 한다.
 * [기부, 요청, 같은 물건인가]
 */
const GENERIC_CASES = [
  // 일반명이 어긋나도 품목명이 구해준다
  [
    { itemName: "참치 통조림 200g", genericName: "참치통조림" },
    { itemName: "참치 통조림 150g", genericName: "참치캔" },
    true,
  ],
  // 품목명으로는 못 잡는 걸 일반명이 잡는다
  [
    { itemName: "스팸 200g", genericName: "햄" },
    { itemName: "런천미트 340g", genericName: "햄" },
    true,
  ],
  // 둘 다 아니라고 하면 아니다
  [
    { itemName: "두유 190mL", genericName: "두유" },
    { itemName: "흰 우유 1L", genericName: "우유" },
    false,
  ],
  // 일반명이 없으면 품목명으로 떨어진다
  [{ itemName: "백미 5kg" }, { itemName: "쌀 20kg", genericName: "쌀" }, true],
];

let failed = 0;
for (const [a, b, want] of CASES) {
  const got = isSameItem(a, b);
  if (got !== want) {
    failed++;
    console.error(
      `  ✗ "${a}" vs "${b}" → ${got} (기대 ${want})` +
        `\n      정규화: "${canonicalItemName(a)}" / "${canonicalItemName(b)}"`
    );
  }
}

for (const [a, b, want] of GENERIC_CASES) {
  const got = isSameItemBy(a, b);
  if (got !== want) {
    failed++;
    console.error(
      `  ✗ ${JSON.stringify(a)} vs ${JSON.stringify(b)} → ${got} (기대 ${want})`
    );
  }
}

const total = CASES.length + GENERIC_CASES.length;

if (failed > 0) {
  console.error(`\n품목 매칭 검사 실패: ${failed}/${total}`);
  process.exit(1);
}
console.log(`품목 매칭 검사 통과: ${total}/${total}`);
