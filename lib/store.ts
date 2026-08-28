import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
import orgSnapshot from "./data/pohang-orgs.json";
import {
  DAY_NAMES,
  DEFAULT_REGION,
  type MatchGrade,
  addDays,
  clampQuantity,
  distanceKm,
  evaluateShareable,
  getRegion,
  isSameItem,
  isSameItemBy,
  canonicalItemName,
  isUrgent,
  orgCategoriesForNeed,
  parseLocalDate,
  startOfToday,
  toISODate,
  withJosa,
} from "./rules";

/**
 * 기부를 받는 기관. 공공데이터포털의 포항시 생활지도 시설현황에서 가져온다.
 * operatingDays/pickupSlots는 그 데이터에 없다 — 실존 기관에 없는 운영시간을
 * 지어 붙이면 허위 정보가 되므로, 비어 있으면 화면에서 "미확인"으로 말한다.
 */
export type Beneficiary = {
  id: string;
  name: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  /** 지역아동센터 / 무료급식소 / 노인의료시설 */
  category?: string;
  /** 이 기관이 돌보는 대상 — 아동·노인·식품 */
  audience?: string;
  /** 이 기관에 특히 맞는 물품 성격 */
  goodsHint?: string;
  operatingDays?: string[];
  pickupSlots?: string[];
  /**
   * 이 기관이 어느 공공데이터에서 왔는지. 한 출처를 갱신할 때 다른 출처의 기관을
   * 지우지 않기 위해 필요하다.
   *  - "beneficiary": 경상북도_푸드뱅크 현황 (손으로 정리한 5곳)
   *  - "lvlhmap":  포항시 생활지도 시설현황 (API로 받아오는 109곳)
   */
  source?: "beneficiary" | "lvlhmap";
};

/**
 * need/application이 가리키는 beneficiaryId가 실제로는 없을 때(예: 직접 데이터를 옮기다가
 * 순간적으로 어긋난 경우) 화면 전체가 죽는 대신 이걸 대신 보여준다.
 * NeedView·ApplicationDetail 어디서든 beneficiary는 항상 있다고 가정하고 .name 등을
 * 바로 읽는 코드가 많아서, undefined를 그대로 넘기는 대신 여기서 안전한 값으로 막는다.
 */
const UNKNOWN_BENEFICIARY: Beneficiary = {
  id: "unknown",
  name: "정보를 찾을 수 없는 기관",
  address: "",
  region: "",
  lat: 0,
  lng: 0,
  operatingDays: [],
  pickupSlots: [],
};

/** 기관이 직접 올리는 "이 물건이 이만큼 필요해요" 한 건. 여럿이 나눠 채운다. */
export type Need = {
  id: string;
  beneficiaryId: string;
  itemName: string;
  category: string;
  targetQty: number;
  filledQty: number;
  note: string;
  /**
   * 용량·상표를 뺀 물건 이름("백미 5kg" → "쌀"). 매칭에서 같은 물건인지 볼 때 쓴다.
   * 사진 판독이나 요청 등록 시점에 한 번 계산해 저장한다 — 매칭 경로에서 모델을
   * 부르면 화면을 열 때마다 API를 쓰게 된다. 없으면 문자열 규칙으로 떨어진다.
   */
  genericName: string | null;
  /** data URL(base64). 파일 스토리지가 따로 없어 Firestore 문서에 그대로 둔다. */
  imageUrl: string | null;
  createdAt: string;
};

export type Donation = {
  id: string;
  itemName: string;
  category: string;
  /** 등록 화면에서 기부자가 적은 개수. 매칭·신청 화면의 기본값이 된다. */
  quantity: number;
  expiryDate: string | null;
  shareable: boolean;
  shareReason: string;
  region: string;
  createdAt: string;
  /**
   * 용량·상표를 뺀 물건 이름("백미 5kg" → "쌀"). 매칭에서 같은 물건인지 볼 때 쓴다.
   * 사진 판독이나 요청 등록 시점에 한 번 계산해 저장한다 — 매칭 경로에서 모델을
   * 부르면 화면을 열 때마다 API를 쓰게 된다. 없으면 문자열 규칙으로 떨어진다.
   */
  genericName: string | null;
  /** 기관이 신청을 검토할 때 문구만으로는 알 수 없는 걸 확인하는 용도. 둘 다 선택. */
  productImageUrl: string | null;
  expiryImageUrl: string | null;
};

export type DateCandidate = { date: string; slot: string };

export type Application = {
  id: string;
  donationId: string;
  needId: string;
  beneficiaryId: string;
  quantity: number;
  /** 기부자가 제안한 날짜 후보들. 기관이 이 중 하나를 골라 확정한다. */
  candidateDates: DateCandidate[];
  /** 기관이 확정한 날짜 — 아직 안 정했으면 null. */
  confirmedDate: string | null;
  confirmedSlot: string | null;
  place: string;
  contact: string;
  status: "pending" | "accepted" | "rejected";
  receiptRequested: boolean;
  createdAt: string;
};

/**
 * 기부를 받는 기관은 두 공공데이터에서 온다. 둘은 역할이 다르고 서로를 대체하지 않는다.
 *
 *  1) 푸드뱅크·푸드마켓 5곳 — 기부를 받아서 나눠주는 거점. 이 앱의 원래 모델이다.
 *  2) 지역아동센터·무료급식소·요양원 109곳 — 물품이 실제로 가 닿는 수혜 기관.
 *
 * 어느 쪽도 지어낸 데이터가 아니다. syncOrgs가 한쪽을 갱신할 때 다른 쪽을 지우지
 * 않도록 source로 구분한다.
 */

/*
 * 출처: 공공데이터포털 "경상북도_푸드뱅크 현황"
 * (data.go.kr/data/15063077, 로그인·API 키 불필요, 25행 중 포항 5행).
 * 위경도는 원본에 없어서 주소를 OpenStreetMap Nominatim으로 지오코딩해 채웠다
 * (fb3만 상세 주소가 안 잡혀 흥해읍 중심 좌표로 대체 — 정확도가 나머지보다 낮음).
 *
 * 운영요일·수거시간대는 원본에 아예 없는 항목이다. 예전에는 임시값을 넣어뒀는데,
 * 실존 기관 이름 옆에 붙은 가짜 시간은 화면에서 사실로 읽힌다. 그래서 아예 비워두고
 * "미확인 — 기관과 협의"로 말한다.
 *
 * id는 고정 문자열을 그대로 쓴다 — 이미 만들어진 요청·신청이 이 id를 참조한다.
 */
const CURATED_BENEFICIARIES: Beneficiary[] = [
  {
    id: "fb1",
    name: "한기장내일을여는집",
    address: "포항시 북구 삼흥로74번길 7-7",
    region: "북구 두호동",
    lat: 36.0686,
    lng: 129.3813,
    category: "푸드뱅크",
    audience: "식품",
    goodsHint: "쌀·부식·생필품",
    source: "beneficiary",
  },
  {
    id: "fb2",
    name: "경동교회",
    address: "포항시 남구 오천읍 해병로347번길 34",
    region: "남구 오천읍",
    lat: 35.964,
    lng: 129.4121,
    category: "푸드뱅크",
    audience: "식품",
    goodsHint: "쌀·부식·생필품",
    source: "beneficiary",
  },
  {
    id: "fb3",
    name: "흥해제일교회",
    address: "포항시 북구 흥해읍 한동로43",
    region: "북구 흥해읍",
    lat: 36.1126,
    lng: 129.354,
    category: "푸드뱅크",
    audience: "식품",
    goodsHint: "쌀·부식·생필품",
    source: "beneficiary",
  },
  {
    id: "fb4",
    name: "선한 이웃",
    address: "포항시 북구 중앙로298번길 3-1",
    region: "북구 중앙동",
    lat: 36.0393,
    lng: 129.3679,
    category: "푸드뱅크",
    audience: "식품",
    goodsHint: "쌀·부식·생필품",
    source: "beneficiary",
  },
  {
    id: "fb5",
    name: "포항모자원 (푸드마켓)",
    address: "포항시 남구 송도로 51",
    region: "남구 송도동",
    lat: 36.0345,
    lng: 129.3802,
    category: "푸드마켓",
    audience: "식품",
    goodsHint: "쌀·부식·생필품",
    source: "beneficiary",
  },
];

/**
 * lib/data/pohang-orgs.json은 /api/admin/sync-orgs?dryRun=1로 공공데이터포털에서
 * 뽑아 커밋해 둔 스냅샷이다. 서비스키가 없는 환경에서도 앱이 뜨게 하는 기본값이다.
 */
const SNAPSHOT_ORGS: Beneficiary[] = orgSnapshot.orgs.map((o) => ({
  ...o,
  source: "lvlhmap" as const,
}));

const SEED_BENEFICIARIES: Beneficiary[] = [
  ...CURATED_BENEFICIARIES,
  ...SNAPSHOT_ORGS,
];

/**
 * 화면에 뜨는 기관 수. 서비스 소개에서 "실제 기관 N곳"을 말할 때 쓴다.
 * 숫자를 문구에 직접 적으면 데이터가 늘거나 줄 때 조용히 거짓말이 된다.
 */
export const ORG_COUNT = SEED_BENEFICIARIES.length;

export const ORG_SOURCE = orgSnapshot.source;
export const ORG_SNAPSHOT = orgSnapshot;

/**
 * beneficiaryId는 여기 없다 — 씨드를 넣는 시점에 orgCategoryForNeed로 알맞은 종류의
 * 실제 기관을 골라 붙인다(요양원에 학용품이 걸리는 조합을 막는다).
 */
const SEED_NEEDS: Omit<
  Need,
  "id" | "createdAt" | "beneficiaryId" | "genericName"
>[] = [
  {
    itemName: "성인용 기저귀 대형",
    category: "위생용품",
    targetQty: 50,
    filledQty: 15,
    note: "요양 어르신 12분께 매주 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "참치 통조림 200g",
    category: "통조림",
    targetQty: 100,
    filledQty: 72,
    note: "결식 아동 도시락 반찬으로 나가요",
    imageUrl: null,
  },
  {
    itemName: "백미 5kg",
    category: "쌀/곡물",
    targetQty: 30,
    filledQty: 4,
    note: "독거 어르신 가정 배달용",
    imageUrl: null,
  },
  {
    itemName: "액체 세탁세제 2L",
    category: "세제",
    targetQty: 40,
    filledQty: 12,
    note: "한부모 가정 생활용품 꾸러미",
    imageUrl: null,
  },
  {
    itemName: "3겹 화장지 30롤",
    category: "화장지",
    targetQty: 20,
    filledQty: 18,
    note: "거의 다 모였어요. 조금만 더요",
    imageUrl: null,
  },
  {
    itemName: "즉석밥 210g",
    category: "기타",
    targetQty: 20,
    filledQty: 15,
    note: "긴급 지원 가정 비상식량",
    imageUrl: null,
  },
  {
    itemName: "스팸 200g",
    category: "통조림",
    targetQty: 60,
    filledQty: 10,
    note: "명절 선물세트 대신 나가는 실속형 반찬",
    imageUrl: null,
  },
  {
    itemName: "찹쌀 3kg",
    category: "쌀/곡물",
    targetQty: 25,
    filledQty: 20,
    note: "떡 만들기 프로그램 재료로 써요",
    imageUrl: null,
  },
  {
    itemName: "현미 2kg",
    category: "쌀/곡물",
    targetQty: 40,
    filledQty: 6,
    note: "건강식 도시락 준비용",
    imageUrl: null,
  },
  {
    itemName: "라면 멀티팩 5개입",
    category: "라면/면류",
    targetQty: 80,
    filledQty: 55,
    note: "1인 가구 비상식량으로 나가요",
    imageUrl: null,
  },
  {
    itemName: "컵라면 모음 6개입",
    category: "라면/면류",
    targetQty: 50,
    filledQty: 47,
    note: "야간 자율학습 학생 간식으로 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "두유 190mL 24팩",
    category: "음료",
    targetQty: 30,
    filledQty: 9,
    note: "우유 못 마시는 아이들 간식용",
    imageUrl: null,
  },
  {
    itemName: "생수 2L 6병",
    category: "음료",
    targetQty: 100,
    filledQty: 34,
    note: "폭염 대비 어르신 가정 배달용",
    imageUrl: null,
  },
  {
    itemName: "흰 우유 1L",
    category: "유제품",
    targetQty: 45,
    filledQty: 40,
    note: "성장기 아동 급식 보충용",
    imageUrl: null,
  },
  {
    itemName: "떠먹는 요구르트 8개입",
    category: "유제품",
    targetQty: 35,
    filledQty: 8,
    note: "장 건강 안 좋은 어르신께 드려요",
    imageUrl: null,
  },
  {
    itemName: "주방세제 500mL",
    category: "세제",
    targetQty: 50,
    filledQty: 33,
    note: "1인 가구 생활용품 꾸러미",
    imageUrl: null,
  },
  {
    itemName: "섬유유연제 1L",
    category: "세제",
    targetQty: 30,
    filledQty: 27,
    note: "거의 다 채워졌어요",
    imageUrl: null,
  },
  {
    itemName: "키친타월 6롤",
    category: "화장지",
    targetQty: 40,
    filledQty: 12,
    note: "다자녀 가정 생필품 지원",
    imageUrl: null,
  },
  {
    itemName: "물티슈 10팩",
    category: "위생용품",
    targetQty: 60,
    filledQty: 44,
    note: "영유아 가정에 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "생리대 대형 20개입",
    category: "생리용품",
    targetQty: 40,
    filledQty: 11,
    note: "위기 청소년 쉼터로 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "팬티라이너 40개입",
    category: "생리용품",
    targetQty: 25,
    filledQty: 19,
    note: "생리용품 꾸러미에 같이 나가요",
    imageUrl: null,
  },
  {
    itemName: "스테인리스 밀폐용기 세트",
    category: "주방용품",
    targetQty: 20,
    filledQty: 3,
    note: "자립준비청년 살림 꾸러미",
    imageUrl: null,
  },
  {
    itemName: "후라이팬 26cm",
    category: "주방용품",
    targetQty: 15,
    filledQty: 12,
    note: "새로 독립하는 가정에 지원돼요",
    imageUrl: null,
  },
  {
    itemName: "겨울 이불 세트 (1인용)",
    category: "의류/침구",
    targetQty: 30,
    filledQty: 7,
    note: "한파 대비 독거 어르신 지원",
    imageUrl: null,
  },
  {
    itemName: "아동용 겨울 점퍼 (110-130)",
    category: "의류/침구",
    targetQty: 25,
    filledQty: 18,
    note: "지역아동센터 아이들에게 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "성인용 내복 세트",
    category: "의류/침구",
    targetQty: 40,
    filledQty: 36,
    note: "거의 다 채워졌어요",
    imageUrl: null,
  },
  {
    itemName: "공책 10권 세트",
    category: "학용품",
    targetQty: 50,
    filledQty: 14,
    note: "새 학기 준비 지원",
    imageUrl: null,
  },
  {
    itemName: "색연필 24색 세트",
    category: "학용품",
    targetQty: 30,
    filledQty: 21,
    note: "지역아동센터 미술수업 재료",
    imageUrl: null,
  },
  {
    itemName: "소금 1kg",
    category: "기타",
    targetQty: 20,
    filledQty: 17,
    note: "김장 나눔 행사 재료로 써요",
    imageUrl: null,
  },
  {
    itemName: "미역 100g",
    category: "기타",
    targetQty: 35,
    filledQty: 9,
    note: "산모·어르신 미역국용",
    imageUrl: null,
  },
  {
    itemName: "선풍기",
    category: "기타",
    targetQty: 15,
    filledQty: 4,
    note: "폭염 대비 냉방 취약가구 지원",
    imageUrl: null,
  },
  {
    itemName: "시리얼",
    category: "기타",
    targetQty: 40,
    filledQty: 28,
    note: "아침 결식 예방 조식 키트",
    imageUrl: null,
  },
  {
    itemName: "양말",
    category: "의류/침구",
    targetQty: 60,
    filledQty: 22,
    note: "겨울철 방한용품 꾸러미",
    imageUrl: null,
  },
  {
    itemName: "수건",
    category: "위생용품",
    targetQty: 50,
    filledQty: 45,
    note: "거의 다 채워졌어요",
    imageUrl: null,
  },
  {
    itemName: "충전기",
    category: "기타",
    targetQty: 20,
    filledQty: 5,
    note: "자립준비청년 생활용품 지원",
    imageUrl: null,
  },
  {
    itemName: "동화책",
    category: "학용품",
    targetQty: 30,
    filledQty: 11,
    note: "지역아동센터 도서실에 비치돼요",
    imageUrl: null,
  },
  {
    itemName: "인형",
    category: "기타",
    targetQty: 25,
    filledQty: 6,
    note: "위기아동 심리지원 물품으로 전달돼요",
    imageUrl: null,
  },
  {
    itemName: "문제집",
    category: "학용품",
    targetQty: 40,
    filledQty: 30,
    note: "저소득 가정 학습 지원",
    imageUrl: null,
  },
  {
    itemName: "보드게임",
    category: "기타",
    targetQty: 20,
    filledQty: 14,
    note: "지역아동센터 방과후 활동용",
    imageUrl: null,
  },
  {
    itemName: "비엔나 소시지",
    category: "통조림",
    targetQty: 70,
    filledQty: 21,
    note: "아이들 도시락 반찬으로 나가요",
    imageUrl: null,
  },
  {
    itemName: "생수 500mL 20팩",
    category: "음료",
    targetQty: 60,
    filledQty: 18,
    note: "폭염 대비 야외활동 지원",
    imageUrl: null,
  },
];

/** 기관 운영시간을 모를 때 화면에 쓰는 문구. 여러 곳에서 같은 말을 해야 한다. */
export const UNKNOWN_HOURS_LABEL = "미확인 (기관과 협의)";
export const UNKNOWN_SLOT_LABEL = "시간 협의";

/**
 * Firestore 문서에 저장돼 있는 필드 이름.
 *
 * 코드에서는 기관을 beneficiary로 부르지만, 이미 쌓인 문서에는 기관을 foodBank라
 * 부르던 시절 이름인 foodBankId로 들어가 있다. 이름을 맞추려면 needs·applications의
 * 문서를 전부 고쳐 써야 하고, 그동안 옛 코드를 쓰는 화면이 같이 깨진다. 그래서
 * 문서를 읽고 쓰는 지점에서만 이 이름을 쓴다.
 *
 * 이걸 beneficiaryId로 바꿔 읽으면 값이 undefined가 되어 기관을 못 찾고,
 * 화면에 "정보를 찾을 수 없는 기관"이 뜬다.
 */
const BENEFICIARY_ID_FIELD = "foodBankId";

/**
 * 도메인 객체를 문서 모양으로 바꾼다. beneficiaryId를 저장된 이름으로 되돌리는 게 전부다.
 * 새로 쓰는 문서도 기존 문서와 같은 필드 이름을 갖게 해서, 읽는 쪽이 한 가지만 알면 되게 한다.
 */
function toDocFields<T extends { beneficiaryId: string }>(value: T) {
  const { beneficiaryId, ...rest } = value;
  return { ...rest, [BENEFICIARY_ID_FIELD]: beneficiaryId };
}

const needsCol = collection(db, "needs");
const donationsCol = collection(db, "donations");
const applicationsCol = collection(db, "applications");
/*
 * 기관 컬렉션. 예전엔 "foodBanks"였고, 기관을 beneficiary로 부르기로 하면서 옮겼다.
 * 문서 id(fb1, ph-66928 …)는 그대로라 요청·신청이 가리키는 값은 손대지 않아도 된다.
 */
const beneficiariesCol = collection(db, "beneficiaries");

/**
 * Firestore가 비어 있으면(새로 만든 프로젝트) 씨드 데이터를 한 번 채운다.
 * 매 요청마다 확인하면 낭비라, 이 서버 인스턴스가 이미 확인했으면 다시 안 본다
 * — 진짜로 비어 있던 적이 없다는 보장은 아니지만, 데모 규모에서 동시에 두 요청이
 * 똑같이 빈 상태를 볼 가능성은 낮고, 그래봐야 씨드가 중복되는 정도라 감수한다.
 */
let seedChecked = false;
async function ensureSeeded() {
  if (seedChecked) return;
  seedChecked = true;
  const snap = await getDocs(query(needsCol, fsLimit(1)));
  if (!snap.empty) return;
  const banks = await ensureBeneficiariesLoaded();
  await Promise.all(
    SEED_NEEDS.map((seed, i) =>
      addDoc(needsCol, {
        ...seed,
        [BENEFICIARY_ID_FIELD]: pickOrgFor(banks, seed.category, seed.itemName, i),
        // 씨드에서는 API를 부르지 않는다. 문자열 규칙으로 채워두고,
        // /api/admin/backfill-generic-names가 나중에 AI 값으로 덮는다.
        genericName: canonicalItemName(seed.itemName),
        createdAt: new Date().toISOString(),
      }),
    ),
  );
}

/**
 * 요청에 어울리는 종류의 기관을 하나 고른다. 같은 종류 안에서는 순번으로 돌려서
 * 41건이 한 기관에 몰리지 않게 한다. 맞는 종류가 없으면 아무 기관에나 붙인다.
 */
function pickOrgFor(
  banks: Beneficiary[],
  category: string,
  itemName: string,
  i: number,
): string {
  const wanted = orgCategoriesForNeed(category, itemName);
  const pool = banks.filter((b) => b.category && wanted.includes(b.category));
  const from = pool.length > 0 ? pool : banks;
  return from[i % from.length].id;
}

/**
 * 기관은 자주 안 바뀌는 기준 정보라, 한 번 불러오면 이 서버 인스턴스가 살아있는
 * 동안은 다시 안 묻는다 — needs처럼 요청마다 바뀌는 데이터가 아니다.
 * 문서 id는 공공데이터의 행 번호에서 만든 고정값(ph-64621 등)이라, 다시 동기화해도
 * 같은 기관이 같은 id를 유지한다 — 이미 걸린 요청·신청이 끊기지 않는다.
 */
let beneficiariesCache: Beneficiary[] | null = null;
async function ensureBeneficiariesLoaded(): Promise<Beneficiary[]> {
  if (beneficiariesCache) return beneficiariesCache;
  let snap = await getDocs(beneficiariesCol);
  if (snap.empty) {
    await Promise.all(
      SEED_BENEFICIARIES.map((fb) => setDoc(doc(beneficiariesCol, fb.id), fb)),
    );
    snap = await getDocs(beneficiariesCol);
  }
  beneficiariesCache = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Beneficiary, "id">),
  }));
  return beneficiariesCache;
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  return ensureBeneficiariesLoaded();
}

export async function getBeneficiary(
  id: string,
): Promise<Beneficiary | undefined> {
  const banks = await ensureBeneficiariesLoaded();
  return banks.find((fb) => fb.id === id);
}

/**
 * 공공데이터에서 새로 받은 기관 목록을 Firestore에 반영한다(/api/admin/sync-orgs).
 *
 * 목록에서 사라진 기관 문서는 지우는데, 그 기관을 참조하던 요청이 남아 있으면
 * 화면이 깨진다(getBeneficiary가 undefined). 그래서 지우기 전에 그 요청들을 같은
 * 종류의 살아있는 기관으로 옮긴다. 하드코딩 시절의 fb1~fb3도 이 경로로 정리된다.
 */
export async function syncOrgs(
  orgs: Beneficiary[],
  options: { redistribute?: boolean } = {},
) {
  // 손으로 정리한 푸드뱅크 5곳도 같이 덮어쓴다 — 예전에 넣어둔 임시 운영시간이
  // Firestore에 남아 있으면 화면에서 계속 사실처럼 보인다.
  // 이 경로로 들어오는 기관은 항상 생활지도 API 출신이다. 호출하는 쪽이 source를
  // 빼먹어도 정리 기준이 틀어지지 않게 여기서 못 박는다.
  const incoming: Beneficiary[] = orgs.map((o) => ({
    ...o,
    source: "lvlhmap" as const,
  }));
  const writing = [...CURATED_BENEFICIARIES, ...incoming];
  await Promise.all(writing.map((o) => setDoc(doc(beneficiariesCol, o.id), o)));

  const alive = new Set(writing.map((o) => o.id));
  const existing = await getDocs(beneficiariesCol);
  // 이번에 갱신한 출처의 기관만 정리 대상이다. 다른 출처는 건드리지 않는다.
  const syncedSources = new Set<string>(["lvlhmap"]);
  const stale = existing.docs
    .filter((d) => !alive.has(d.id))
    .filter((d) =>
      syncedSources.has((d.data().source as string | undefined) ?? "lvlhmap"),
    )
    .map((d) => d.id);

  // 지울 기관을 참조하는 요청이 남으면 화면이 깨진다(getBeneficiary가 undefined).
  // 지우기 전에 같은 종류의 살아있는 기관으로 옮긴다.
  const staleSet = new Set(stale);
  const needsSnap = await getDocs(needsCol);
  // redistribute를 켜면 멀쩡한 요청까지 전부 다시 배정한다. 기관이 5곳에서 114곳으로
  // 늘어난 뒤 요청이 예전 5곳에만 몰려 있으면, 새로 들어온 기관은 화면에 안 나온다.
  const orphaned = needsSnap.docs.filter((d) => {
    if (options.redistribute) return true;
    const id = d.data()[BENEFICIARY_ID_FIELD] as string;
    return staleSet.has(id) || !alive.has(id);
  });
  await Promise.all(
    orphaned.map((d, i) => {
      const data = d.data();
      return updateDoc(doc(needsCol, d.id), {
        [BENEFICIARY_ID_FIELD]: pickOrgFor(
          writing,
          data.category as string,
          data.itemName as string,
          i,
        ),
      });
    }),
  );

  await Promise.all(stale.map((id) => deleteDoc(doc(beneficiariesCol, id))));

  beneficiariesCache = null;
  return {
    orgsWritten: writing.length,
    staleRemoved: stale.length,
    needsRemapped: orphaned.length,
  };
}

function needFromDoc(id: string, data: Record<string, unknown>): Need {
  return {
    id,
    beneficiaryId: data[BENEFICIARY_ID_FIELD] as string,
    itemName: data.itemName as string,
    category: data.category as string,
    targetQty: data.targetQty as number,
    filledQty: data.filledQty as number,
    note: (data.note as string) ?? "",
    imageUrl: (data.imageUrl as string | null) ?? null,
    genericName: (data.genericName as string | null) ?? null,
    createdAt: data.createdAt as string,
  };
}

function donationFromDoc(id: string, data: Record<string, unknown>): Donation {
  return {
    id,
    itemName: data.itemName as string,
    category: data.category as string,
    quantity: data.quantity as number,
    expiryDate: (data.expiryDate as string | null) ?? null,
    shareable: data.shareable as boolean,
    shareReason: data.shareReason as string,
    region: data.region as string,
    createdAt: data.createdAt as string,
    productImageUrl: (data.productImageUrl as string | null) ?? null,
    expiryImageUrl: (data.expiryImageUrl as string | null) ?? null,
    genericName: (data.genericName as string | null) ?? null,
  };
}

function applicationFromDoc(
  id: string,
  data: Record<string, unknown>,
): Application {
  return {
    id,
    donationId: data.donationId as string,
    needId: data.needId as string,
    beneficiaryId: data[BENEFICIARY_ID_FIELD] as string,
    quantity: data.quantity as number,
    candidateDates: (data.candidateDates as DateCandidate[]) ?? [],
    confirmedDate: (data.confirmedDate as string | null) ?? null,
    confirmedSlot: (data.confirmedSlot as string | null) ?? null,
    place: data.place as string,
    contact: data.contact as string,
    status: data.status as Application["status"],
    receiptRequested: (data.receiptRequested as boolean) ?? false,
    createdAt: data.createdAt as string,
  };
}

export async function getNeed(id: string): Promise<Need | undefined> {
  await ensureSeeded();
  const snap = await getDoc(doc(needsCol, id));
  if (!snap.exists()) return undefined;
  return needFromDoc(snap.id, snap.data());
}

export async function createNeed(input: {
  beneficiaryId: string;
  itemName: string;
  category: string;
  targetQty: number;
  note: string;
  imageUrl: string | null;
  genericName?: string | null;
}): Promise<Need> {
  const data = {
    ...input,
    genericName: input.genericName ?? null,
    filledQty: 0,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(needsCol, toDocFields(data));
  return { id: ref.id, ...data };
}

/**
 * 기존 요청들의 일반명을 채운다(/api/admin/backfill-generic-names).
 *
 * 씨드로 들어간 요청은 문자열 규칙으로 대충 채워져 있다 — "3겹 화장지 30롤"이
 * "3겹화장지"로 남는 식이다. 모델에게 한 번 물어보면 "화장지"가 된다.
 * 품목명이 서로 겹쳐도 호출은 한 번이다 — 중복을 제거해 한 프롬프트로 보낸다.
 *
 * force가 false면 아직 비어 있는 것만 채우고, true면 전부 다시 계산한다.
 */
export async function backfillGenericNames(
  derive: (names: string[]) => Promise<Map<string, string>>,
  force = false,
) {
  const snap = await getDocs(needsCol);
  const targets = snap.docs.filter((d) => force || !d.data().genericName);
  if (targets.length === 0)
    return { scanned: snap.size, updated: 0, distinctNames: 0, names: {} };

  const distinct = [
    ...new Set(targets.map((d) => d.data().itemName as string)),
  ];
  const derived = await derive(distinct);

  await Promise.all(
    targets.map((d) => {
      const itemName = d.data().itemName as string;
      const value = derived.get(itemName);
      if (!value) return Promise.resolve();
      return updateDoc(doc(needsCol, d.id), { genericName: value });
    }),
  );

  return {
    scanned: snap.size,
    updated: targets.length,
    distinctNames: distinct.length,
    names: Object.fromEntries(derived),
  };
}

export type NeedView = Need & {
  beneficiary: Beneficiary;
  progress: number;
  remainingQty: number;
  pendingQty: number;
  urgent: boolean;
};

/** need 하나와, 이미 불러온 관련 데이터를 조합한다. beneficiary만 Firestore(캐시)를 본다. */
async function computeNeedView(
  need: Need,
  pendingQty: number,
): Promise<NeedView> {
  // Math.round는 99.5%도 100%로 올려버려서, 1개가 남았는데도 "목표 달성"으로
  // 보이는 경우가 생긴다. 실제로 다 채워졌을 때(filledQty >= targetQty)만 100%를 준다.
  const progress =
    need.filledQty >= need.targetQty
      ? 100
      : Math.min(99, Math.round((need.filledQty / need.targetQty) * 100));

  return {
    ...need,
    beneficiary:
      (await getBeneficiary(need.beneficiaryId)) ?? UNKNOWN_BENEFICIARY,
    progress,
    remainingQty: Math.max(0, need.targetQty - need.filledQty),
    pendingQty,
    urgent: isUrgent(progress),
  };
}

/**
 * 대기중 신청들을 한 번에 불러와 need별로 묶는다. 카테고리가 다른 대기중 신청은
 * 수락돼도 그 진행률을 안 채우니, "대기중 반영 시" 미리보기에서도 빼야 한다.
 * need마다 따로 물어보면(N+1) Firestore 왕복이 요청 수만큼 늘어나니 한 번에 처리한다.
 */
async function pendingQtyByNeed(needs: Need[]): Promise<Map<string, number>> {
  const pendingSnap = await getDocs(
    query(applicationsCol, where("status", "==", "pending")),
  );
  const pendingApps = pendingSnap.docs.map((d) =>
    applicationFromDoc(d.id, d.data()),
  );
  if (pendingApps.length === 0) return new Map();

  const donationIds = Array.from(new Set(pendingApps.map((a) => a.donationId)));
  const donations = await Promise.all(donationIds.map((id) => getDonation(id)));
  const categoryByDonationId = new Map(
    donations.filter(Boolean).map((d) => [d!.id, d!.category]),
  );

  const needCategoryById = new Map(needs.map((n) => [n.id, n.category]));
  const result = new Map<string, number>();
  for (const app of pendingApps) {
    const needCategory = needCategoryById.get(app.needId);
    if (needCategory === undefined) continue;
    if (categoryByDonationId.get(app.donationId) !== needCategory) continue;
    result.set(app.needId, (result.get(app.needId) ?? 0) + app.quantity);
  }
  return result;
}

/** 진행률 게시판용. 도움이 필요한 것(진행률 낮은 것) 먼저. */
export async function listNeeds(): Promise<NeedView[]> {
  await ensureSeeded();
  const snap = await getDocs(needsCol);
  const needsList = snap.docs.map((d) => needFromDoc(d.id, d.data()));
  const pendingByNeed = await pendingQtyByNeed(needsList);

  const views = await Promise.all(
    needsList.map((need) =>
      computeNeedView(need, pendingByNeed.get(need.id) ?? 0),
    ),
  );
  return views.sort(
    (a, b) => Number(b.urgent) - Number(a.urgent) || a.progress - b.progress,
  );
}

/** 신청 상세(describeApplication)처럼 need 하나만 필요한 자리용. */
export async function getNeedView(id: string): Promise<NeedView | undefined> {
  const need = await getNeed(id);
  if (!need) return undefined;
  const pendingByNeed = await pendingQtyByNeed([need]);
  return computeNeedView(need, pendingByNeed.get(need.id) ?? 0);
}

export type NeedMatch = NeedView & {
  needScore: number;
  needLabel: string;
  needReason: string;
  distanceKm: number;
  rank: number;
  /** 카테고리가 맞는지. 진행률 반영 여부와 같은 조건이라 그대로 둔다. */
  exactMatch: boolean;
  /** 품목명까지 따진 3단계. 정렬과 안내 문구 선택에만 쓴다. */
  matchGrade: MatchGrade;
};

/** 정렬용. 요청한 바로 그 물건 → 같은 분류의 다른 물건 → 분류가 다른 물건 순. */
const GRADE_ORDER: Record<MatchGrade, number> = {
  exact: 0,
  similar: 1,
  different: 2,
};

function needLabelOf(score: number) {
  if (score >= 70) return "매우 필요";
  if (score >= 40) return "필요";
  return "여유";
}

/**
 * 기부하려는 품목과 카테고리가 맞는 '필요 건'일수록 위로 오도록 순위를 매긴다.
 * 카테고리가 다르다고 목록에서 아예 숨기지는 않는다 — 다른 기관에 직접
 * 나눔하고 싶을 수도 있으니, 항상 전체를 보여주되 우선순위만 다르게 준다.
 * 부족분이 클수록, 진행률이 낮아 도움이 필요할수록, 가까울수록 위로 온다.
 */
export async function matchNeeds(
  category: string,
  itemName: string,
  regionName: string,
  /** 기부 물품의 일반명. 사진 판독 때 모델이 뽑아준 값. 없으면 품목명으로 비교한다. */
  genericName: string | null = null,
): Promise<NeedMatch[]> {
  const origin = getRegion(regionName || DEFAULT_REGION);
  const all = await listNeeds();

  return (
    all
      .map((need) => {
        const isExact = need.category === category;
        // 카테고리가 맞아도 물건이 다를 수 있다 — 즉석밥 요청에 라면을 내는 경우다.
        // 이걸 구분해야 "같은 분류라 함께 받는다"는 사실을 화면에서 말할 수 있다.
        const matchGrade: MatchGrade = !isExact
          ? "different"
          : isSameItemBy({ itemName, genericName }, need)
            ? "exact"
            : "similar";
        const distance = distanceKm(origin, need.beneficiary);
        const shortage = need.remainingQty / need.targetQty;

        const base = Math.round(shortage * 60);
        const urgentBonus = need.urgent ? 25 : 0;
        const proximity = distance <= 3 ? 15 : distance <= 7 ? 8 : 0;
        const raw = isExact
          ? base + urgentBonus + proximity
          : Math.round((base + proximity) * 0.5);
        const needScore = Math.max(0, Math.min(100, raw));

        const needReason =
          matchGrade === "different"
            ? `${category} 요청은 아니지만 ${need.beneficiary.name}에서 다른 물품을 기다려요`
            : matchGrade === "similar"
              ? // 품목명이 "즉석밥 210g"처럼 한글로 안 끝나면 withJosa가 받침을 못 읽는다.
                // 단위마다 읽는 법이 달라(그램→을, 리터→를) 규칙으로 풀기 어려우니
                // 조사가 필요 없는 문장으로 쓴다.
                `${need.itemName} 요청이지만, 같은 분류라 함께 받아요`
              : need.remainingQty === 0
                ? "목표를 이미 채웠어요. 여유분으로 받아요"
                : need.urgent
                  ? `${withJosa(need.itemName, "이", "가")} ${need.remainingQty}개 더 필요해요. 도움이 필요해요`
                  : `${need.remainingQty}개만 더 모으면 목표를 채워요`;

        return {
          ...need,
          needScore,
          needLabel: needLabelOf(needScore),
          needReason,
          distanceKm: distance,
          rank: 0,
          exactMatch: isExact,
          matchGrade,
        };
      })
      // 요청한 바로 그 물건을 먼저 보여준다. 점수만으로 정렬하면 분류가 다른데
      // 아주 급한 요청이 딱 맞는 요청보다 위로 올 수 있다.
      .sort(
        (a, b) =>
          GRADE_ORDER[a.matchGrade] - GRADE_ORDER[b.matchGrade] ||
          b.needScore - a.needScore ||
          a.distanceKm - b.distanceKm,
      )
      .map((n, i) => ({ ...n, rank: i + 1 }))
  );
}

export type DateOption = {
  date: string;
  day: string;
  slot: string;
  reason: string;
};

export type DateRecommendation = {
  ok: boolean;
  message: string;
  options: DateOption[];
};

/**
 * 기관 운영일 ∩ 기부자 가능 요일 ∩ 시간대 교집합.
 * "양쪽 모두 가능한 시간대만 걸러서 날짜 추천"의 실제 구현.
 * Beneficiary를 조회하는 부분만 Firestore(캐시)를 본다. 나머지는 순수 계산.
 *
 * donorAvailability는 요일마다 다른 시간대를 가질 수 있다(예: 월요일은 오전만,
 * 화요일은 오후만 가능). 키로 들어있는 요일만 "가능한 요일"이고, 값은 그 요일의
 * 시간대("상관없음"|"오전"|"오후")다. 빈 객체는 "아무 요일이나 시간대나 괜찮다"는 뜻이다.
 */
export async function recommendDates(
  beneficiaryId: string,
  donorAvailability: Record<string, string>,
  maxDateISO?: string | null,
  limit = 3,
): Promise<DateRecommendation> {
  const fb = await getBeneficiary(beneficiaryId);
  if (!fb)
    return { ok: false, message: "기관 정보를 찾을 수 없어요", options: [] };

  // 공공데이터에는 기관 운영일·수거시간이 없다. 없는 걸 지어내면 실존 기관에 대한
  // 허위 정보가 되므로, 모르면 "모른다"로 두고 회원님 가능 요일만 제약으로 쓴다.
  const operatingDays = fb.operatingDays ?? [];
  const pickupSlots = fb.pickupSlots ?? [];
  const hoursKnown = operatingDays.length > 0 && pickupSlots.length > 0;

  const hasRestriction = Object.keys(donorAvailability).length > 0;
  const today = startOfToday();
  const limitDate = maxDateISO ? parseLocalDate(maxDateISO) : null;
  const options: DateOption[] = [];
  let blockedByExpiry = false;

  // 당일 수거는 비현실적이라 내일부터 2주를 훑는다.
  for (let offset = 1; offset <= 14 && options.length < limit; offset++) {
    const date = addDays(today, offset);
    const day = DAY_NAMES[date.getDay()];

    if (hoursKnown && !operatingDays.includes(day)) continue;
    if (hasRestriction && !(day in donorAvailability)) continue;

    if (limitDate && date.getTime() > limitDate.getTime()) {
      blockedByExpiry = true;
      continue;
    }

    const daySlot = hasRestriction ? donorAvailability[day] : "상관없음";
    const slot = hoursKnown
      ? daySlot === "상관없음"
        ? pickupSlots[0]
        : pickupSlots.find((s) => s.startsWith(daySlot))
      : daySlot === "상관없음"
        ? UNKNOWN_SLOT_LABEL
        : daySlot;
    if (!slot) continue;

    options.push({
      date: toISODate(date),
      day,
      slot,
      reason: hoursKnown
        ? `기관 운영일(${day}) · 회원님 가능 요일${daySlot !== "상관없음" ? `(${daySlot})` : ""} · ${slot}`
        : `회원님 가능 요일(${day}) · 기관 운영일은 미확인이라 시간은 협의해요`,
    });
  }

  if (options.length > 0) {
    return {
      ok: true,
      message: `양쪽 모두 가능한 날짜 ${options.length}개를 찾았어요`,
      options,
    };
  }
  if (blockedByExpiry) {
    return {
      ok: false,
      message: "유통기한 전에 양쪽 모두 가능한 날이 없어요",
      options: [],
    };
  }
  return {
    ok: false,
    message: hoursKnown
      ? `두 분 모두 가능한 날이 없어요. ${withJosa(fb.name, "은", "는")} ${operatingDays.join("·")}요일 ${pickupSlots.join(", ")}에만 받아요`
      : "앞으로 2주 안에 회원님이 가능한 날이 없어요. 가능한 요일을 다시 골라주세요",
    options: [],
  };
}

export async function createDonation(input: {
  itemName: string;
  category: string;
  quantity?: number;
  expiryDate: string | null;
  region: string;
  productImageUrl?: string | null;
  expiryImageUrl?: string | null;
  genericName?: string | null;
}): Promise<Donation> {
  // 나눔 가능 여부는 클라이언트가 보낸 값을 믿지 않고 항상 서버가 판정한다.
  const verdict = evaluateShareable(input.expiryDate);
  const data = {
    itemName: input.itemName,
    category: input.category,
    // 나눔 가능 여부와 같은 이유로, 개수도 클라이언트가 보낸 값을 그대로 믿지 않는다.
    quantity: clampQuantity(input.quantity ?? 1),
    expiryDate: input.expiryDate,
    shareable: verdict.shareable,
    shareReason: verdict.reason,
    region: input.region || DEFAULT_REGION,
    createdAt: new Date().toISOString(),
    productImageUrl: input.productImageUrl ?? null,
    expiryImageUrl: input.expiryImageUrl ?? null,
    genericName: input.genericName ?? null,
  };
  const ref = await addDoc(donationsCol, data);
  return { id: ref.id, ...data };
}

export async function getDonation(id: string): Promise<Donation | undefined> {
  const snap = await getDoc(doc(donationsCol, id));
  if (!snap.exists()) return undefined;
  return donationFromDoc(snap.id, snap.data());
}

export async function updateDonation(
  id: string,
  patch: Partial<
    Pick<
      Donation,
      "itemName" | "category" | "quantity" | "expiryDate" | "region"
    >
  >,
): Promise<Donation | undefined> {
  const donation = await getDonation(id);
  if (!donation) return undefined;

  const update: Record<string, unknown> = {};
  if (patch.itemName !== undefined) update.itemName = patch.itemName;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.quantity !== undefined)
    update.quantity = clampQuantity(patch.quantity);
  if (patch.region !== undefined) update.region = patch.region;
  if (patch.expiryDate !== undefined) {
    update.expiryDate = patch.expiryDate;
    const verdict = evaluateShareable(patch.expiryDate);
    update.shareable = verdict.shareable;
    update.shareReason = verdict.reason;
  }
  await updateDoc(doc(donationsCol, id), update);
  return { ...donation, ...update } as Donation;
}

export async function createApplication(
  input: Pick<
    Application,
    | "donationId"
    | "needId"
    | "quantity"
    | "candidateDates"
    | "place"
    | "contact"
  >,
): Promise<Application | undefined> {
  const need = await getNeed(input.needId);
  if (!need) return undefined;

  const data = {
    ...input,
    confirmedDate: null,
    confirmedSlot: null,
    beneficiaryId: need.beneficiaryId,
    status: "pending" as const,
    receiptRequested: false,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(applicationsCol, toDocFields(data));
  return { id: ref.id, ...data };
}

export async function getApplication(
  id: string,
): Promise<Application | undefined> {
  const snap = await getDoc(doc(applicationsCol, id));
  if (!snap.exists()) return undefined;
  return applicationFromDoc(snap.id, snap.data());
}

export async function listApplications(): Promise<Application[]> {
  const snap = await getDocs(
    query(applicationsCol, orderBy("createdAt", "desc")),
  );
  return snap.docs.map((d) => applicationFromDoc(d.id, d.data()));
}

/**
 * 기관이 수락하면 그 수량만큼 진행률이 실제로 채워진다 — 단, 기부 물품 카테고리가
 * 그 요청과 정확히 일치할 때만이다. 카테고리가 다른 기부도 신청·수락 자체는 막지
 * 않지만(기관이 어차피 필요해서 받는 물건일 수 있으니), 그 요청의 진행률 숫자에는
 * 반영하지 않는다 — 안 그러면 "초콜릿을 받았는데 즉석밥 목표가 채워지는" 것처럼
 * 숫자가 실제와 안 맞게 된다.
 *
 * 수락(accepted)하려면 기부자가 제안한 날짜 후보 중 하나를 반드시 같이 골라야 한다
 * — 날짜 없이는 "언제 전달할지" 자체가 정해지지 않으니 수락도 의미가 없다.
 *
 * Firestore는 이제 정말로 여러 인스턴스가 동시에 건드릴 수 있어서(예전 인메모리는
 * 프로세스 하나였다), 읽고 더해서 쓰는 이 로직을 트랜잭션으로 묶는다 — 안 그러면
 * 같은 요청을 동시에 두 번 수락 처리할 때 진행률이 두 배로 뛸 수 있다.
 */
export async function updateApplicationStatus(
  id: string,
  status: Application["status"],
  confirmed?: DateCandidate,
): Promise<Application | undefined> {
  return runTransaction(db, async (tx) => {
    const appRef = doc(applicationsCol, id);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) return undefined;
    const application = applicationFromDoc(appSnap.id, appSnap.data());

    if (status === "accepted") {
      const isValidCandidate = confirmed
        ? application.candidateDates.some(
            (c) => c.date === confirmed.date && c.slot === confirmed.slot,
          )
        : false;
      if (!isValidCandidate) return undefined;
    }

    const needRef = doc(needsCol, application.needId);
    const donationRef = doc(donationsCol, application.donationId);
    const [needSnap, donationSnap] = await Promise.all([
      tx.get(needRef),
      tx.get(donationRef),
    ]);
    const need = needSnap.exists()
      ? needFromDoc(needSnap.id, needSnap.data())
      : undefined;
    const donation = donationSnap.exists()
      ? donationFromDoc(donationSnap.id, donationSnap.data())
      : undefined;
    const countsTowardProgress = Boolean(
      need && donation && need.category === donation.category,
    );

    if (need && countsTowardProgress) {
      let filledQty = need.filledQty;
      if (status === "accepted" && application.status !== "accepted") {
        // 목표치를 넘겨 채우지 않는다. 여러 신청이 동시에 수락돼도 진행률은 100%를 넘지 않는다.
        filledQty = Math.min(need.targetQty, filledQty + application.quantity);
      } else if (application.status === "accepted" && status !== "accepted") {
        filledQty = Math.max(0, filledQty - application.quantity);
      }
      if (filledQty !== need.filledQty) {
        tx.update(needRef, { filledQty });
      }
    }

    const patch: Record<string, unknown> = { status };
    if (status === "accepted" && confirmed) {
      patch.confirmedDate = confirmed.date;
      patch.confirmedSlot = confirmed.slot;
    }
    tx.update(appRef, patch);

    return { ...application, ...patch } as Application;
  });
}

export async function requestReceipt(
  id: string,
): Promise<Application | undefined> {
  const application = await getApplication(id);
  if (!application) return undefined;
  await updateDoc(doc(applicationsCol, id), { receiptRequested: true });
  return { ...application, receiptRequested: true };
}

export async function describeApplication(application: Application) {
  const [donation, needView, beneficiary] = await Promise.all([
    getDonation(application.donationId),
    getNeedView(application.needId),
    getBeneficiary(application.beneficiaryId),
  ]);
  return {
    ...application,
    // 삭제 기능이 없어 신청이 참조하는 donation/beneficiary는 항상 존재한다는 가정.
    // 나중에 삭제 경로가 생기면 이 단언이 깨진다.
    donation: donation!,
    beneficiary: beneficiary ?? UNKNOWN_BENEFICIARY,
    need: needView,
  };
}

export type ApplicationDetail = Awaited<ReturnType<typeof describeApplication>>;
