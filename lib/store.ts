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
  /** data URL(base64). 파일 스토리지가 따로 없어 인메모리 레코드에 그대로 둔다. */
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
];

// Next.js dev 서버는 API 라우트 파일별로 이 모듈을 별도 청크로 다시 컴파일해서,
// 모듈 스코프 변수로 두면 라우트마다 다른 인스턴스를 참조하게 된다.
// globalThis에 얹어 같은 프로세스 안에서 하나의 저장소를 공유하도록 한다.
const globalForStore = globalThis as unknown as {
  __foodBankStoreV3?: {
    foodBanks: FoodBank[];
    needs: Map<string, Need>;
    donations: Map<string, Donation>;
    applications: Map<string, Application>;
    needSeq: number;
    donationSeq: number;
    applicationSeq: number;
  };
};

const store = (globalForStore.__foodBankStoreV3 ??= (() => {
  const needs = new Map<string, Need>();
  let needSeq = 1;
  for (const seed of SEED_NEEDS) {
    const id = `n${needSeq++}`;
    needs.set(id, { ...seed, id, createdAt: new Date().toISOString() });
  }
  return {
    foodBanks: FOOD_BANKS,
    needs,
    donations: new Map<string, Donation>(),
    applications: new Map<string, Application>(),
    needSeq,
    donationSeq: 1,
    applicationSeq: 1,
  };
})());

const foodBanks = store.foodBanks;
const needs = store.needs;
const donations = store.donations;
const applications = store.applications;

export function getFoodBanks() {
  return foodBanks;
}

export function getFoodBank(id: string) {
  return foodBanks.find((fb) => fb.id === id);
}

export function getNeed(id: string) {
  return needs.get(id);
}

export function createNeed(input: {
  foodBankId: string;
  itemName: string;
  category: string;
  targetQty: number;
  note: string;
  imageUrl: string | null;
}): Need {
  const need: Need = {
    ...input,
    id: `n${store.needSeq++}`,
    filledQty: 0,
    createdAt: new Date().toISOString(),
  };
  needs.set(need.id, need);
  return need;
}

export type NeedView = Need & {
  foodBank: FoodBank;
  progress: number;
  remainingQty: number;
  pendingQty: number;
  urgent: boolean;
};

function toView(need: Need): NeedView {
  // 카테고리가 다른 대기중 신청은 수락돼도 이 진행률을 안 채우니, "대기중 반영 시"
  // 미리보기에서도 빼야 한다 — 안 그러면 실제로는 안 오를 숫자를 예고하게 된다.
  const pendingQty = Array.from(applications.values())
    .filter((app) => app.needId === need.id && app.status === "pending")
    .filter((app) => getDonation(app.donationId)?.category === need.category)
    .reduce((sum, app) => sum + app.quantity, 0);

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

/** 진행률 게시판용. 도움이 필요한 것(진행률 낮은 것) 먼저. */
export function listNeeds(): NeedView[] {
  return Array.from(needs.values())
    .map(toView)
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || a.progress - b.progress);
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
export function matchNeeds(category: string, itemName: string, regionName: string): NeedMatch[] {
  const origin = getRegion(regionName || DEFAULT_REGION);
  const all = listNeeds();

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

export function createDonation(input: {
  itemName: string;
  category: string;
  quantity?: number;
  expiryDate: string | null;
  region: string;
}): Donation {
  // 나눔 가능 여부는 클라이언트가 보낸 값을 믿지 않고 항상 서버가 판정한다.
  const verdict = evaluateShareable(input.expiryDate);
  const donation: Donation = {
    id: `d${store.donationSeq++}`,
    itemName: input.itemName,
    category: input.category,
    // 나눔 가능 여부와 같은 이유로, 개수도 클라이언트가 보낸 값을 그대로 믿지 않는다.
    quantity: clampQuantity(input.quantity ?? 1),
    expiryDate: input.expiryDate,
    shareable: verdict.shareable,
    shareReason: verdict.reason,
    region: input.region || DEFAULT_REGION,
    createdAt: new Date().toISOString(),
  };
  donations.set(donation.id, donation);
  return donation;
}

export function getDonation(id: string) {
  return donations.get(id);
}

export function updateDonation(
  id: string,
  patch: Partial<Pick<Donation, "itemName" | "category" | "quantity" | "expiryDate" | "region">>
) {
  const donation = donations.get(id);
  if (!donation) return undefined;

  if (patch.itemName !== undefined) donation.itemName = patch.itemName;
  if (patch.category !== undefined) donation.category = patch.category;
  if (patch.quantity !== undefined) donation.quantity = clampQuantity(patch.quantity);
  if (patch.region !== undefined) donation.region = patch.region;
  if (patch.expiryDate !== undefined) {
    donation.expiryDate = patch.expiryDate;
    const verdict = evaluateShareable(patch.expiryDate);
    donation.shareable = verdict.shareable;
    donation.shareReason = verdict.reason;
  }
  return donation;
}

export function createApplication(
  input: Pick<Application, "donationId" | "needId" | "quantity" | "candidateDates" | "place" | "contact">
): Application | undefined {
  const need = needs.get(input.needId);
  if (!need) return undefined;

  const application: Application = {
    ...input,
    confirmedDate: null,
    confirmedSlot: null,
    foodBankId: need.foodBankId,
    id: `a${store.applicationSeq++}`,
    status: "pending",
    receiptRequested: false,
    createdAt: new Date().toISOString(),
  };
  applications.set(application.id, application);
  return application;
}

export function getApplication(id: string) {
  return applications.get(id);
}

export function listApplications() {
  return Array.from(applications.values()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
 */
export function updateApplicationStatus(
  id: string,
  status: Application["status"],
  confirmed?: DateCandidate
) {
  const application = applications.get(id);
  if (!application) return undefined;

  if (status === "accepted") {
    const isValidCandidate = confirmed
      ? application.candidateDates.some((c) => c.date === confirmed.date && c.slot === confirmed.slot)
      : false;
    if (!isValidCandidate) return undefined;
  }

  const need = needs.get(application.needId);
  const donation = getDonation(application.donationId);
  const countsTowardProgress = Boolean(need && donation && need.category === donation.category);

  if (need && countsTowardProgress) {
    if (status === "accepted" && application.status !== "accepted") {
      // 목표치를 넘겨 채우지 않는다. 여러 신청이 동시에 수락돼도 진행률은 100%를 넘지 않는다.
      need.filledQty = Math.min(need.targetQty, need.filledQty + application.quantity);
    } else if (application.status === "accepted" && status !== "accepted") {
      need.filledQty = Math.max(0, need.filledQty - application.quantity);
    }
  }

  application.status = status;
  if (status === "accepted" && confirmed) {
    application.confirmedDate = confirmed.date;
    application.confirmedSlot = confirmed.slot;
  }
  return application;
}

export function requestReceipt(id: string) {
  const application = applications.get(id);
  if (!application) return undefined;
  application.receiptRequested = true;
  return application;
}

export function describeApplication(application: Application) {
  const need = needs.get(application.needId);
  return {
    ...application,
    // 삭제 기능이 없어 신청이 참조하는 donation/foodBank는 항상 존재한다는 가정.
    // 나중에 삭제 경로가 생기면 이 단언이 깨진다.
    donation: getDonation(application.donationId)!,
    foodBank: getFoodBank(application.foodBankId)!,
    need: need ? toView(need) : undefined,
  };
}

export type ApplicationDetail = ReturnType<typeof describeApplication>;
