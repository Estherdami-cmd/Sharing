import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit as fsLimit,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";
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
  isUrgent,
  parseLocalDate,
  startOfToday,
  toISODate,
  withJosa,
} from "./rules";

export type FoodBank = {
  id: string;
  name: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  operatingDays: string[];
  pickupSlots: string[];
};

/** 기관이 직접 올리는 "이 물건이 이만큼 필요해요" 한 건. 여럿이 나눠 채운다. */
export type Need = {
  id: string;
  foodBankId: string;
  itemName: string;
  category: string;
  targetQty: number;
  filledQty: number;
  note: string;
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
  /** 기관이 신청을 검토할 때 문구만으로는 알 수 없는 걸 확인하는 용도. 둘 다 선택. */
  productImageUrl: string | null;
  expiryImageUrl: string | null;
};

export type DateCandidate = { date: string; slot: string };

export type Application = {
  id: string;
  donationId: string;
  needId: string;
  foodBankId: string;
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

// 목업 데이터: 실제 포항 지역 푸드뱅크 데이터로 나중에 교체.
// 기관은 자주 안 바뀌는 기준 정보라 Firestore 왕복 없이 코드에 그대로 둔다.
const FOOD_BANKS: FoodBank[] = [
  {
    id: "fb1",
    name: "포항 나눔 푸드뱅크",
    address: "포항시 남구 오천읍",
    region: "남구 오천읍",
    lat: 35.966,
    lng: 129.414,
    operatingDays: ["월", "수", "금"],
    pickupSlots: ["오전 10-12시", "오후 2-4시"],
  },
  {
    id: "fb2",
    name: "포항 생활지원센터",
    address: "포항시 북구 죽도동",
    region: "북구 죽도동",
    lat: 36.038,
    lng: 129.365,
    operatingDays: ["화", "목"],
    pickupSlots: ["오후 1-5시"],
  },
  {
    id: "fb3",
    name: "포항 사랑의 열매",
    address: "포항시 남구 효자동",
    region: "남구 효자동",
    lat: 36.008,
    lng: 129.33,
    operatingDays: ["월", "화", "수", "목", "금"],
    pickupSlots: ["오전 9-12시", "오후 2-6시"],
  },
];

const SEED_NEEDS: Omit<Need, "id" | "createdAt">[] = [
  {
    foodBankId: "fb3",
    itemName: "성인용 기저귀 대형",
    category: "위생용품",
    targetQty: 50,
    filledQty: 15,
    note: "요양 어르신 12분께 매주 전달돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "참치 통조림 200g",
    category: "통조림",
    targetQty: 100,
    filledQty: 72,
    note: "결식 아동 도시락 반찬으로 나가요",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "백미 5kg",
    category: "쌀/곡물",
    targetQty: 30,
    filledQty: 4,
    note: "독거 어르신 가정 배달용",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "액체 세탁세제 2L",
    category: "세제",
    targetQty: 40,
    filledQty: 12,
    note: "한부모 가정 생활용품 꾸러미",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "3겹 화장지 30롤",
    category: "화장지",
    targetQty: 20,
    filledQty: 18,
    note: "거의 다 모였어요. 조금만 더요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "즉석밥 210g",
    category: "기타",
    targetQty: 20,
    filledQty: 15,
    note: "긴급 지원 가정 비상식량",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "스팸 200g",
    category: "통조림",
    targetQty: 60,
    filledQty: 10,
    note: "명절 선물세트 대신 나가는 실속형 반찬",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "찹쌀 3kg",
    category: "쌀/곡물",
    targetQty: 25,
    filledQty: 20,
    note: "떡 만들기 프로그램 재료로 써요",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "현미 2kg",
    category: "쌀/곡물",
    targetQty: 40,
    filledQty: 6,
    note: "건강식 도시락 준비용",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "라면 멀티팩 5개입",
    category: "라면/면류",
    targetQty: 80,
    filledQty: 55,
    note: "1인 가구 비상식량으로 나가요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "컵라면 모음 6개입",
    category: "라면/면류",
    targetQty: 50,
    filledQty: 47,
    note: "야간 자율학습 학생 간식으로 전달돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "두유 190mL 24팩",
    category: "음료",
    targetQty: 30,
    filledQty: 9,
    note: "우유 못 마시는 아이들 간식용",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "생수 2L 6병",
    category: "음료",
    targetQty: 100,
    filledQty: 34,
    note: "폭염 대비 어르신 가정 배달용",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "흰 우유 1L",
    category: "유제품",
    targetQty: 45,
    filledQty: 40,
    note: "성장기 아동 급식 보충용",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "떠먹는 요구르트 8개입",
    category: "유제품",
    targetQty: 35,
    filledQty: 8,
    note: "장 건강 안 좋은 어르신께 드려요",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "주방세제 500mL",
    category: "세제",
    targetQty: 50,
    filledQty: 33,
    note: "1인 가구 생활용품 꾸러미",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "섬유유연제 1L",
    category: "세제",
    targetQty: 30,
    filledQty: 27,
    note: "거의 다 채워졌어요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "키친타월 6롤",
    category: "화장지",
    targetQty: 40,
    filledQty: 12,
    note: "다자녀 가정 생필품 지원",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "물티슈 10팩",
    category: "위생용품",
    targetQty: 60,
    filledQty: 44,
    note: "영유아 가정에 전달돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "생리대 대형 20개입",
    category: "생리용품",
    targetQty: 40,
    filledQty: 11,
    note: "위기 청소년 쉼터로 전달돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "팬티라이너 40개입",
    category: "생리용품",
    targetQty: 25,
    filledQty: 19,
    note: "생리용품 꾸러미에 같이 나가요",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "스테인리스 밀폐용기 세트",
    category: "주방용품",
    targetQty: 20,
    filledQty: 3,
    note: "자립준비청년 살림 꾸러미",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "후라이팬 26cm",
    category: "주방용품",
    targetQty: 15,
    filledQty: 12,
    note: "새로 독립하는 가정에 지원돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "겨울 이불 세트 (1인용)",
    category: "의류/침구",
    targetQty: 30,
    filledQty: 7,
    note: "한파 대비 독거 어르신 지원",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "아동용 겨울 점퍼 (110-130)",
    category: "의류/침구",
    targetQty: 25,
    filledQty: 18,
    note: "지역아동센터 아이들에게 전달돼요",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "성인용 내복 세트",
    category: "의류/침구",
    targetQty: 40,
    filledQty: 36,
    note: "거의 다 채워졌어요",
    imageUrl: null,
  },
  {
    foodBankId: "fb2",
    itemName: "공책 10권 세트",
    category: "학용품",
    targetQty: 50,
    filledQty: 14,
    note: "새 학기 준비 지원",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "색연필 24색 세트",
    category: "학용품",
    targetQty: 30,
    filledQty: 21,
    note: "지역아동센터 미술수업 재료",
    imageUrl: null,
  },
  {
    foodBankId: "fb1",
    itemName: "소금 1kg",
    category: "기타",
    targetQty: 20,
    filledQty: 17,
    note: "김장 나눔 행사 재료로 써요",
    imageUrl: null,
  },
  {
    foodBankId: "fb3",
    itemName: "미역 100g",
    category: "기타",
    targetQty: 35,
    filledQty: 9,
    note: "산모·어르신 미역국용",
    imageUrl: null,
  },
];

const needsCol = collection(db, "needs");
const donationsCol = collection(db, "donations");
const applicationsCol = collection(db, "applications");

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
  await Promise.all(
    SEED_NEEDS.map((seed) => addDoc(needsCol, { ...seed, createdAt: new Date().toISOString() }))
  );
}

export function getFoodBanks() {
  return FOOD_BANKS;
}

export function getFoodBank(id: string) {
  return FOOD_BANKS.find((fb) => fb.id === id);
}

function needFromDoc(id: string, data: Record<string, unknown>): Need {
  return {
    id,
    foodBankId: data.foodBankId as string,
    itemName: data.itemName as string,
    category: data.category as string,
    targetQty: data.targetQty as number,
    filledQty: data.filledQty as number,
    note: (data.note as string) ?? "",
    imageUrl: (data.imageUrl as string | null) ?? null,
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
  };
}

function applicationFromDoc(id: string, data: Record<string, unknown>): Application {
  return {
    id,
    donationId: data.donationId as string,
    needId: data.needId as string,
    foodBankId: data.foodBankId as string,
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
  foodBankId: string;
  itemName: string;
  category: string;
  targetQty: number;
  note: string;
  imageUrl: string | null;
}): Promise<Need> {
  const data = { ...input, filledQty: 0, createdAt: new Date().toISOString() };
  const ref = await addDoc(needsCol, data);
  return { id: ref.id, ...data };
}

export type NeedView = Need & {
  foodBank: FoodBank;
  progress: number;
  remainingQty: number;
  pendingQty: number;
  urgent: boolean;
};

/** need 하나와, 이미 불러온 관련 데이터를 순수하게 조합만 한다 — Firestore를 모른다. */
function computeNeedView(need: Need, pendingQty: number): NeedView {
  // Math.round는 99.5%도 100%로 올려버려서, 1개가 남았는데도 "목표 달성"으로
  // 보이는 경우가 생긴다. 실제로 다 채워졌을 때(filledQty >= targetQty)만 100%를 준다.
  const progress =
    need.filledQty >= need.targetQty
      ? 100
      : Math.min(99, Math.round((need.filledQty / need.targetQty) * 100));

  return {
    ...need,
    foodBank: getFoodBank(need.foodBankId)!,
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
  const pendingSnap = await getDocs(query(applicationsCol, where("status", "==", "pending")));
  const pendingApps = pendingSnap.docs.map((d) => applicationFromDoc(d.id, d.data()));
  if (pendingApps.length === 0) return new Map();

  const donationIds = Array.from(new Set(pendingApps.map((a) => a.donationId)));
  const donations = await Promise.all(donationIds.map((id) => getDonation(id)));
  const categoryByDonationId = new Map(
    donations.filter(Boolean).map((d) => [d!.id, d!.category])
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

  return needsList
    .map((need) => computeNeedView(need, pendingByNeed.get(need.id) ?? 0))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.progress - b.progress);
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
const GRADE_ORDER: Record<MatchGrade, number> = { exact: 0, similar: 1, different: 2 };

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
  regionName: string
): Promise<NeedMatch[]> {
  const origin = getRegion(regionName || DEFAULT_REGION);
  const all = await listNeeds();

  return all
    .map((need) => {
      const isExact = need.category === category;
      // 카테고리가 맞아도 물건이 다를 수 있다 — 즉석밥 요청에 라면을 내는 경우다.
      // 이걸 구분해야 "같은 분류라 함께 받는다"는 사실을 화면에서 말할 수 있다.
      const matchGrade: MatchGrade = !isExact
        ? "different"
        : isSameItem(itemName, need.itemName)
          ? "exact"
          : "similar";
      const distance = distanceKm(origin, need.foodBank);
      const shortage = need.remainingQty / need.targetQty;

      const base = Math.round(shortage * 60);
      const urgentBonus = need.urgent ? 25 : 0;
      const proximity = distance <= 3 ? 15 : distance <= 7 ? 8 : 0;
      const raw = isExact ? base + urgentBonus + proximity : Math.round((base + proximity) * 0.5);
      const needScore = Math.max(0, Math.min(100, raw));

      const needReason =
        matchGrade === "different"
          ? `${category} 요청은 아니지만 ${need.foodBank.name}에서 다른 물품을 기다려요`
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
        a.distanceKm - b.distanceKm
    )
    .map((n, i) => ({ ...n, rank: i + 1 }));
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
 * FoodBank 기준 정보만 쓰고 Firestore는 건드리지 않아 동기 함수로 남는다.
 *
 * donorAvailability는 요일마다 다른 시간대를 가질 수 있다(예: 월요일은 오전만,
 * 화요일은 오후만 가능). 키로 들어있는 요일만 "가능한 요일"이고, 값은 그 요일의
 * 시간대("상관없음"|"오전"|"오후")다. 빈 객체는 "아무 요일이나 시간대나 괜찮다"는 뜻이다.
 */
export function recommendDates(
  foodBankId: string,
  donorAvailability: Record<string, string>,
  maxDateISO?: string | null,
  limit = 3
): DateRecommendation {
  const fb = getFoodBank(foodBankId);
  if (!fb) return { ok: false, message: "기관 정보를 찾을 수 없어요", options: [] };

  const hasRestriction = Object.keys(donorAvailability).length > 0;
  const today = startOfToday();
  const limitDate = maxDateISO ? parseLocalDate(maxDateISO) : null;
  const options: DateOption[] = [];
  let blockedByExpiry = false;

  // 당일 수거는 비현실적이라 내일부터 2주를 훑는다.
  for (let offset = 1; offset <= 14 && options.length < limit; offset++) {
    const date = addDays(today, offset);
    const day = DAY_NAMES[date.getDay()];

    if (!fb.operatingDays.includes(day)) continue;
    if (hasRestriction && !(day in donorAvailability)) continue;

    if (limitDate && date.getTime() > limitDate.getTime()) {
      blockedByExpiry = true;
      continue;
    }

    const daySlot = hasRestriction ? donorAvailability[day] : "상관없음";
    const slot =
      daySlot === "상관없음" ? fb.pickupSlots[0] : fb.pickupSlots.find((s) => s.startsWith(daySlot));
    if (!slot) continue;

    options.push({
      date: toISODate(date),
      day,
      slot,
      reason: `기관 운영일(${day}) · 회원님 가능 요일${daySlot !== "상관없음" ? `(${daySlot})` : ""} · ${slot}`,
    });
  }

  if (options.length > 0) {
    return { ok: true, message: `양쪽 모두 가능한 날짜 ${options.length}개를 찾았어요`, options };
  }
  if (blockedByExpiry) {
    return { ok: false, message: "유통기한 전에 양쪽 모두 가능한 날이 없어요", options: [] };
  }
  return {
    ok: false,
    message: `두 분 모두 가능한 날이 없어요. ${withJosa(fb.name, "은", "는")} ${fb.operatingDays.join("·")}요일 ${fb.pickupSlots.join(", ")}에만 받아요`,
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
  patch: Partial<Pick<Donation, "itemName" | "category" | "quantity" | "expiryDate" | "region">>
): Promise<Donation | undefined> {
  const donation = await getDonation(id);
  if (!donation) return undefined;

  const update: Record<string, unknown> = {};
  if (patch.itemName !== undefined) update.itemName = patch.itemName;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.quantity !== undefined) update.quantity = clampQuantity(patch.quantity);
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
  input: Pick<Application, "donationId" | "needId" | "quantity" | "candidateDates" | "place" | "contact">
): Promise<Application | undefined> {
  const need = await getNeed(input.needId);
  if (!need) return undefined;

  const data = {
    ...input,
    confirmedDate: null,
    confirmedSlot: null,
    foodBankId: need.foodBankId,
    status: "pending" as const,
    receiptRequested: false,
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(applicationsCol, data);
  return { id: ref.id, ...data };
}

export async function getApplication(id: string): Promise<Application | undefined> {
  const snap = await getDoc(doc(applicationsCol, id));
  if (!snap.exists()) return undefined;
  return applicationFromDoc(snap.id, snap.data());
}

export async function listApplications(): Promise<Application[]> {
  const snap = await getDocs(query(applicationsCol, orderBy("createdAt", "desc")));
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
  confirmed?: DateCandidate
): Promise<Application | undefined> {
  return runTransaction(db, async (tx) => {
    const appRef = doc(applicationsCol, id);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) return undefined;
    const application = applicationFromDoc(appSnap.id, appSnap.data());

    if (status === "accepted") {
      const isValidCandidate = confirmed
        ? application.candidateDates.some((c) => c.date === confirmed.date && c.slot === confirmed.slot)
        : false;
      if (!isValidCandidate) return undefined;
    }

    const needRef = doc(needsCol, application.needId);
    const donationRef = doc(donationsCol, application.donationId);
    const [needSnap, donationSnap] = await Promise.all([tx.get(needRef), tx.get(donationRef)]);
    const need = needSnap.exists() ? needFromDoc(needSnap.id, needSnap.data()) : undefined;
    const donation = donationSnap.exists() ? donationFromDoc(donationSnap.id, donationSnap.data()) : undefined;
    const countsTowardProgress = Boolean(need && donation && need.category === donation.category);

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

export async function requestReceipt(id: string): Promise<Application | undefined> {
  const application = await getApplication(id);
  if (!application) return undefined;
  await updateDoc(doc(applicationsCol, id), { receiptRequested: true });
  return { ...application, receiptRequested: true };
}

export async function describeApplication(application: Application) {
  const [donation, needView] = await Promise.all([
    getDonation(application.donationId),
    getNeedView(application.needId),
  ]);
  return {
    ...application,
    // 삭제 기능이 없어 신청이 참조하는 donation/foodBank는 항상 존재한다는 가정.
    // 나중에 삭제 경로가 생기면 이 단언이 깨진다.
    donation: donation!,
    foodBank: getFoodBank(application.foodBankId)!,
    need: needView,
  };
}

export type ApplicationDetail = Awaited<ReturnType<typeof describeApplication>>;
