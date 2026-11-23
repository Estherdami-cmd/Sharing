import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  type AllocationSchedule,
  type DeliveryMethod,
  type ScheduleSlot,
  checkHubCriteria,
  daysUntil,
  isHub,
  linkedFacilities,
  nearestHub,
  normalizeCandidates,
  normalizeScheduleSlot,
} from "./hub";
import { distanceKm, getRegion, isSameItemBy } from "./rules";
import {
  type NeedView,
  getBeneficiaries,
  getBeneficiary,
  getDonation,
  listNeeds,
} from "./store";

/**
 * 배분기관에 들어온 물품 한 건(입고).
 *
 *   pending  기업·개인이 "배분기관에 맡기기"를 눌렀다. 배분기관이 확인하기 전
 *   stored   배분기관이 승인해 보관 중. 여기서부터 시설에 나눠 줄 수 있다
 *   rejected 배분기관이 받지 않았다
 *
 * 배분은 상태가 아니라 allocations로 남긴다. 한 번에 다 나누지 않을 수도 있어서다.
 * 남은 수량이 0이면 화면에서 "배분 완료"로 본다.
 */
export type Allocation = {
  /** 일정을 주고받을 때 이 배분 한 건을 가리킨다. 일정 기능 전에 만든 배분에는 없다. */
  id?: string;
  needId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  needItemName: string;
  qty: number;
  at: string;
  /** 전달 일정. 일정 기능 전에 만든 배분은 null(일정 없이 기록만 됨). */
  schedule?: AllocationSchedule | null;
};

export type DonorType = "company" | "individual" | "walkin";

export type Intake = {
  id: string;
  hubId: string;
  donationId: string | null;
  donorName: string;
  donorType: DonorType;
  itemName: string;
  category: string;
  genericName: string | null;
  quantity: number;
  expiryDate: string | null;
  productImageUrl: string | null;
  status: "pending" | "stored" | "rejected";
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  allocations: Allocation[];
};

export type IntakeView = Intake & {
  hubName: string;
  allocatedQty: number;
  remainingQty: number;
  daysLeft: number | null;
};

const intakesCol = collection(db, "intakes");
const needsCol = collection(db, "needs");

function intakeFromDoc(id: string, data: Record<string, unknown>): Intake {
  return {
    id,
    hubId: data.hubId as string,
    donationId: (data.donationId as string | null) ?? null,
    donorName: (data.donorName as string) ?? "",
    donorType: (data.donorType as DonorType) ?? "individual",
    itemName: data.itemName as string,
    category: data.category as string,
    genericName: (data.genericName as string | null) ?? null,
    quantity: data.quantity as number,
    expiryDate: (data.expiryDate as string | null) ?? null,
    productImageUrl: (data.productImageUrl as string | null) ?? null,
    status: data.status as Intake["status"],
    createdAt: data.createdAt as string,
    approvedAt: (data.approvedAt as string | null) ?? null,
    rejectedAt: (data.rejectedAt as string | null) ?? null,
    rejectReason: (data.rejectReason as string | null) ?? null,
    allocations: (data.allocations as Allocation[]) ?? [],
  };
}

async function toView(intake: Intake): Promise<IntakeView> {
  const hub = await getBeneficiary(intake.hubId);
  const allocatedQty = intake.allocations.reduce((sum, a) => sum + a.qty, 0);
  return {
    ...intake,
    hubName: hub?.name ?? "배분기관",
    allocatedQty,
    remainingQty: Math.max(0, intake.quantity - allocatedQty),
    daysLeft: daysUntil(intake.expiryDate),
  };
}

/** 기부자 지역에서 가장 가까운 배분기관. 맡기기 버튼이 이 곳을 추천한다. */
export async function recommendHub(regionName: string) {
  const orgs = await getBeneficiaries();
  const origin = getRegion(regionName);
  const hub = nearestHub(origin, orgs);
  if (!hub) return null;
  return {
    id: hub.id,
    name: hub.name,
    category: hub.category ?? "배분기관",
    distanceKm: distanceKm(origin, hub),
    linkedCount: linkedFacilities(hub.id, orgs).length,
  };
}

export type HubRecommendation = NonNullable<Awaited<ReturnType<typeof recommendHub>>>;

/**
 * 맡길 수 있는 배분기관 전체, 기부자 지역에서 가까운 순. 추천은 맨 앞(가장 가까운 곳)이고,
 * 기부자가 거래하던 곳이나 협력 NGO처럼 다른 곳을 직접 고를 수 있게 함께 내려준다.
 */
export async function listHubOptions(regionName: string): Promise<HubRecommendation[]> {
  const orgs = await getBeneficiaries();
  const origin = getRegion(regionName);
  return orgs
    .filter((o) => isHub(o))
    .map((hub) => ({
      id: hub.id,
      name: hub.name,
      category: hub.category ?? "배분기관",
      distanceKm: distanceKm(origin, hub),
      linkedCount: linkedFacilities(hub.id, orgs).length,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export class IntakeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** 기업·개인이 "배분기관에 맡기기"를 누르면 입고 대기로 들어간다. */
export async function createIntakeFromDonation(input: {
  donationId: string;
  hubId: string;
  donorName: string;
  donorType: DonorType;
}): Promise<Intake> {
  const [donation, hub] = await Promise.all([
    getDonation(input.donationId),
    getBeneficiary(input.hubId),
  ]);
  if (!donation) throw new IntakeError("등록한 물품을 찾을 수 없어요", 404);
  if (!hub || !isHub(hub)) throw new IntakeError("배분기관을 찾을 수 없어요", 404);
  if (!donation.shareable) throw new IntakeError("나눔할 수 없는 물품이에요");
  // 버튼은 기준을 넘을 때만 열리지만, 화면을 우회한 요청도 같은 기준으로 막는다.
  const { ok } = checkHubCriteria(donation);
  if (!ok) throw new IntakeError("배분기관이 받는 기준에 맞지 않아요");

  const data = {
    hubId: hub.id,
    donationId: donation.id,
    // 등록 화면에서 기업으로 들어온 물품이면 그때 적은 이름·유형을 그대로 쓴다.
    donorName: (input.donorName.trim() || donation.donorName || "").slice(0, 40),
    donorType: donation.donorType === "company" ? ("company" as const) : input.donorType,
    itemName: donation.itemName,
    category: donation.category,
    genericName: donation.genericName,
    quantity: donation.quantity,
    expiryDate: donation.expiryDate,
    productImageUrl: donation.productImageUrl,
    status: "pending" as const,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    rejectedAt: null,
    rejectReason: null,
    allocations: [] as Allocation[],
  };
  const ref = await addDoc(intakesCol, data);
  return { id: ref.id, ...data };
}

/**
 * 배분기관이 물품을 직접 받아 찍어 올린 경우. 실물을 이미 손에 들고 있으니
 * 입고 대기를 거치지 않고 바로 보관으로 들어간다.
 */
export async function createWalkinIntakes(
  hubId: string,
  items: {
    itemName: string;
    category: string;
    quantity: number;
    expiryDate: string | null;
    donorName: string;
  }[],
  imageUrl: string | null,
): Promise<Intake[]> {
  const hub = await getBeneficiary(hubId);
  if (!hub || !isHub(hub)) throw new IntakeError("배분기관을 찾을 수 없어요", 404);
  const now = new Date().toISOString();
  return Promise.all(
    items.map(async (item) => {
      const data = {
        hubId,
        donationId: null,
        donorName: item.donorName.trim().slice(0, 40),
        donorType: "walkin" as const,
        itemName: item.itemName,
        category: item.category,
        genericName: null,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        productImageUrl: imageUrl,
        status: "stored" as const,
        createdAt: now,
        approvedAt: now,
        rejectedAt: null,
        rejectReason: null,
        allocations: [] as Allocation[],
      };
      const ref = await addDoc(intakesCol, data);
      return { id: ref.id, ...data };
    }),
  );
}

export async function getIntake(id: string): Promise<IntakeView | undefined> {
  const snap = await getDoc(doc(intakesCol, id));
  if (!snap.exists()) return undefined;
  return toView(intakeFromDoc(snap.id, snap.data()));
}

export async function listIntakes(hubId: string): Promise<IntakeView[]> {
  const snap = await getDocs(query(intakesCol, where("hubId", "==", hubId)));
  const intakes = snap.docs
    .map((d) => intakeFromDoc(d.id, d.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return Promise.all(intakes.map(toView));
}

export async function reviewIntake(
  id: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<IntakeView | undefined> {
  const ref = doc(intakesCol, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return undefined;
  const intake = intakeFromDoc(snap.id, snap.data());
  if (intake.status !== "pending") throw new IntakeError("이미 처리한 입고예요");
  const now = new Date().toISOString();
  const patch =
    action === "approve"
      ? { status: "stored" as const, approvedAt: now }
      : {
          status: "rejected" as const,
          rejectedAt: now,
          rejectReason: (reason ?? "").trim().slice(0, 200) || null,
        };
  await updateDoc(ref, patch);
  return toView({ ...intake, ...patch });
}

export type DistributionCandidate = NeedView & {
  linked: boolean;
  exactItem: boolean;
  suggestedQty: number;
};

/**
 * 이 물품을 나눠 줄 수 있는 시설 요청들. 카테고리가 같아야 진행률이 실제로 오른다.
 *
 * 정렬: 같은 물건 → 이 배분기관이 맡은 시설 → 먼저 요청한 곳.
 * "먼저 요청한 곳"을 앞에 두는 건 시설이 손든 순서를 존중하기 위해서다.
 * 제안 수량은 그 순서대로 남은 만큼 채운다 — 기관이 숫자를 고쳐 확정한다.
 */
export async function distributionCandidates(
  intake: IntakeView,
): Promise<DistributionCandidate[]> {
  const [needs, orgs] = await Promise.all([listNeeds(), getBeneficiaries()]);
  const linkedIds = new Set(linkedFacilities(intake.hubId, orgs).map((o) => o.id));

  const sorted = needs
    .filter((n) => n.category === intake.category && n.remainingQty > 0)
    .filter((n) => !isHub(n.beneficiary))
    .map((n) => ({
      ...n,
      linked: linkedIds.has(n.beneficiaryId),
      exactItem: isSameItemBy(intake, n),
    }))
    .sort(
      (a, b) =>
        Number(b.exactItem) - Number(a.exactItem) ||
        Number(b.linked) - Number(a.linked) ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .slice(0, 8);

  let left = intake.remainingQty;
  return sorted.map((n) => {
    const suggestedQty = Math.min(left, n.remainingQty);
    left -= suggestedQty;
    return { ...n, suggestedQty };
  });
}

/**
 * 수량을 나눠 시설에 보낸다. 시설 요청의 채워진 수량이 그만큼 오른다.
 * 입고와 요청을 한 트랜잭션으로 묶어, 동시에 두 번 눌러도 남은 수량보다 많이 나가지 않게 한다.
 */
export async function distributeIntake(
  id: string,
  requested: { needId: string; qty: number }[],
  scheduleInput: { method?: unknown; candidates?: unknown } = {},
): Promise<IntakeView> {
  const method: DeliveryMethod = scheduleInput.method === "pickup" ? "pickup" : "delivery";
  const candidates = normalizeCandidates(scheduleInput.candidates);
  if (candidates.length === 0) throw new IntakeError("전달 날짜 후보를 하나 이상 골라주세요");
  const lines = requested
    .map((r) => ({ needId: String(r.needId), qty: Math.floor(Number(r.qty)) }))
    .filter((r) => Number.isFinite(r.qty) && r.qty > 0);
  if (lines.length === 0) throw new IntakeError("나눌 수량을 입력해주세요");
  if (new Set(lines.map((l) => l.needId)).size !== lines.length)
    throw new IntakeError("같은 시설이 두 번 들어갔어요");

  const orgs = await getBeneficiaries();
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const updated = await runTransaction(db, async (tx) => {
    const ref = doc(intakesCol, id);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new IntakeError("입고 기록을 찾을 수 없어요", 404);
    const intake = intakeFromDoc(snap.id, snap.data());
    if (intake.status !== "stored") throw new IntakeError("보관 중인 물품만 나눌 수 있어요");

    const allocated = intake.allocations.reduce((s, a) => s + a.qty, 0);
    const total = lines.reduce((s, l) => s + l.qty, 0);
    if (total > intake.quantity - allocated)
      throw new IntakeError(`남은 수량(${intake.quantity - allocated}개)보다 많이 나눌 수 없어요`);

    const needSnaps = await Promise.all(lines.map((l) => tx.get(doc(needsCol, l.needId))));
    const now = new Date().toISOString();
    const newAllocations: Allocation[] = [];

    needSnaps.forEach((ns, i) => {
      if (!ns.exists()) throw new IntakeError("시설 요청을 찾을 수 없어요", 404);
      const data = ns.data();
      const beneficiaryId = data.foodBankId as string;
      const filledQty = data.filledQty as number;
      const targetQty = data.targetQty as number;
      // 카테고리가 같을 때만 진행률을 올린다 — 신청 수락(updateApplicationStatus)과 같은 규칙.
      if (data.category === intake.category) {
        tx.update(ns.ref, { filledQty: Math.min(targetQty, filledQty + lines[i].qty) });
      }
      newAllocations.push({
        id: `${Date.now().toString(36)}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        needId: ns.id,
        beneficiaryId,
        beneficiaryName: orgById.get(beneficiaryId)?.name ?? "시설",
        needItemName: data.itemName as string,
        qty: lines[i].qty,
        at: now,
        schedule: {
          method,
          candidates,
          status: "proposed",
          confirmedDate: null,
          confirmedSlot: null,
          counter: null,
          updatedAt: now,
          deliveredAt: null,
        },
      });
    });

    const allocations = [...intake.allocations, ...newAllocations];
    tx.update(ref, { allocations });
    return { ...intake, allocations };
  });

  return toView(updated);
}

export type ScheduleAction =
  | { action: "confirm"; date: string; slot: string }
  | { action: "counter"; date: string; slot: string; note?: string }
  | { action: "accept-counter" }
  | { action: "repropose"; method?: string; candidates: unknown }
  | { action: "delivered" };

/**
 * 배분 한 건의 일정을 바꾼다. 시설과 배분기관이 같은 관리 코드를 써서 누가 눌렀는지는
 * 가리지 않고, 지금 상태에서 말이 되는 동작인지만 본다.
 *   confirm         시설이 후보 중 하나를 고름 (proposed → confirmed)
 *   counter         시설이 다른 날짜를 요청 (proposed·countered·confirmed → countered)
 *   accept-counter  배분기관이 요청한 날짜를 수락 (countered → confirmed)
 *   repropose       배분기관이 후보를 다시 보냄 (전달 전이면 언제든 → proposed)
 *   delivered       전달 마침 (confirmed → delivered)
 */
export async function updateAllocationSchedule(
  intakeId: string,
  allocationId: string,
  input: ScheduleAction,
): Promise<IntakeView> {
  const updated = await runTransaction(db, async (tx) => {
    const ref = doc(intakesCol, intakeId);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new IntakeError("입고 기록을 찾을 수 없어요", 404);
    const intake = intakeFromDoc(snap.id, snap.data());
    const index = intake.allocations.findIndex((a) => a.id === allocationId);
    const allocation = intake.allocations[index];
    if (!allocation) throw new IntakeError("배분 기록을 찾을 수 없어요", 404);
    const current = allocation.schedule;
    if (!current) throw new IntakeError("일정 없이 기록된 배분이에요");
    if (current.status === "delivered") throw new IntakeError("이미 전달을 마친 배분이에요");

    const now = new Date().toISOString();
    let next: AllocationSchedule;
    switch (input.action) {
      case "confirm": {
        if (current.status !== "proposed") throw new IntakeError("지금은 후보에서 고를 수 없어요");
        const picked = current.candidates.find((c) => c.date === input.date && c.slot === input.slot);
        if (!picked) throw new IntakeError("보낸 후보 중에서 골라주세요");
        next = { ...current, status: "confirmed", confirmedDate: picked.date, confirmedSlot: picked.slot, counter: null };
        break;
      }
      case "counter": {
        const slot = normalizeScheduleSlot(input);
        if (!slot) throw new IntakeError("요청할 날짜와 시간대를 골라주세요");
        const note = typeof input.note === "string" ? input.note.trim().slice(0, 100) : "";
        next = { ...current, status: "countered", confirmedDate: null, confirmedSlot: null, counter: { ...slot, note } };
        break;
      }
      case "accept-counter": {
        if (current.status !== "countered" || !current.counter)
          throw new IntakeError("시설이 요청한 날짜가 없어요");
        next = {
          ...current,
          status: "confirmed",
          confirmedDate: current.counter.date,
          confirmedSlot: current.counter.slot,
          counter: null,
        };
        break;
      }
      case "repropose": {
        const candidates = normalizeCandidates(input.candidates);
        if (candidates.length === 0) throw new IntakeError("전달 날짜 후보를 하나 이상 골라주세요");
        const method: DeliveryMethod =
          input.method === "pickup" ? "pickup" : input.method === "delivery" ? "delivery" : current.method;
        next = { ...current, method, candidates, status: "proposed", confirmedDate: null, confirmedSlot: null, counter: null };
        break;
      }
      case "delivered": {
        if (current.status !== "confirmed") throw new IntakeError("일정이 확정된 뒤에 완료로 바꿀 수 있어요");
        next = { ...current, status: "delivered", deliveredAt: now };
        break;
      }
      default:
        throw new IntakeError("알 수 없는 동작이에요");
    }

    const allocations = intake.allocations.map((a, i) =>
      i === index ? { ...a, schedule: { ...next, updatedAt: now } } : a,
    );
    tx.update(ref, { allocations });
    return { ...intake, allocations };
  });
  return toView(updated);
}

/** 시설 입장에서 본 배분 한 건. 어느 배분기관이 무엇을 언제 주는지. */
export type IncomingDelivery = {
  intakeId: string;
  hubId: string;
  hubName: string;
  itemName: string;
  category: string;
  expiryDate: string | null;
  productImageUrl: string | null;
  allocation: Allocation & { id: string; schedule: AllocationSchedule };
};

/**
 * 이 시설로 배분된 물품 전체. 맡은 배분기관 말고 다른 권역 배분기관이 보낼 수도 있어서
 * 입고 전체를 훑는다 — 시연 규모에서는 문서 수가 적어 충분하다.
 */
export async function listIncomingDeliveries(beneficiaryId: string): Promise<IncomingDelivery[]> {
  const [snap, orgs] = await Promise.all([getDocs(intakesCol), getBeneficiaries()]);
  const nameById = new Map(orgs.map((o) => [o.id, o.name]));
  const rows: IncomingDelivery[] = [];
  for (const d of snap.docs) {
    const intake = intakeFromDoc(d.id, d.data());
    for (const a of intake.allocations) {
      if (a.beneficiaryId !== beneficiaryId || !a.id || !a.schedule) continue;
      rows.push({
        intakeId: intake.id,
        hubId: intake.hubId,
        hubName: nameById.get(intake.hubId) ?? "배분기관",
        itemName: intake.itemName,
        category: intake.category,
        expiryDate: intake.expiryDate,
        productImageUrl: intake.productImageUrl,
        allocation: a as IncomingDelivery["allocation"],
      });
    }
  }
  return rows.sort((a, b) => b.allocation.at.localeCompare(a.allocation.at));
}

export type { ScheduleSlot };

/** 배분기관 대시보드 한 화면에 필요한 것. */
export async function hubOverview(hubId: string) {
  const [orgs, needs, intakes] = await Promise.all([
    getBeneficiaries(),
    listNeeds(),
    listIntakes(hubId),
  ]);
  const hub = orgs.find((o) => o.id === hubId);
  if (!hub || !isHub(hub)) return undefined;
  const facilities = linkedFacilities(hubId, orgs);
  const facilityIds = new Set(facilities.map((f) => f.id));
  const facilityNeeds = needs.filter((n) => facilityIds.has(n.beneficiaryId));
  return { hub, facilities, facilityNeeds, intakes };
}

export type HubOverview = NonNullable<Awaited<ReturnType<typeof hubOverview>>>;

/** 시설 쪽에서 "어느 배분기관 소속인지"를 보여줄 때. */
export async function hubOfFacility(facilityId: string) {
  const orgs = await getBeneficiaries();
  const facility = orgs.find((o) => o.id === facilityId);
  if (!facility || isHub(facility)) return null;
  return nearestHub(facility, orgs);
}
