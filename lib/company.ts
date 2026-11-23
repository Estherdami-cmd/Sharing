import { createHash, randomInt } from "node:crypto";
import { addDoc, collection, doc, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { listIntakesByDonations } from "./hub-store";
import { describeApplication, listApplicationsByDonations, listDonationsByCompany } from "./store";

/**
 * 기업·단체. 회원 가입이 없는 서비스라, 처음 기업으로 기부할 때 자동으로 만들어지고
 * 관리 코드 하나를 받는다. 이 코드가 곧 그 기업의 열쇠다 — 다음 기부를 같은 기업으로
 * 묶고, 신청 조회에서 지금까지 맡긴 물품이 어디까지 갔는지 본다.
 *
 * 코드는 원문을 저장하지 않고 해시만 둔다. 발급할 때 한 번 보여주고 끝이다.
 */
export type Company = {
  id: string;
  name: string;
  manager: string;
  contact: string;
  createdAt: string;
};

const companiesCol = collection(db, "companies");

/** 헷갈리는 글자(0/O, 1/I/L)를 뺐다. 8자면 경우의 수가 1조 가까이 돼 맞혀 볼 수 없다. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function normalizeCompanyCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function hashCode(code: string): string {
  return createHash("sha256").update(`yeoresi-company:${normalizeCompanyCode(code)}`).digest("hex");
}

function newCode(): string {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

/** 새 기업을 만들고 관리 코드를 돌려준다. 코드는 이때만 원문으로 볼 수 있다. */
export async function createCompany(input: { name: string; manager: string; contact: string }) {
  const code = newCode();
  const data = {
    name: input.name,
    manager: input.manager,
    contact: input.contact,
    codeHash: hashCode(code),
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(companiesCol, data);
  const company: Company = { id: ref.id, name: data.name, manager: data.manager, contact: data.contact, createdAt: data.createdAt };
  return { company, code };
}

export async function findCompanyByCode(code: string): Promise<Company | null> {
  if (normalizeCompanyCode(code).length !== 8) return null;
  const snap = await getDocs(query(companiesCol, where("codeHash", "==", hashCode(code)), limit(1)));
  const d = snap.docs[0];
  if (!d) return null;
  const data = d.data();
  return {
    id: d.id,
    name: data.name as string,
    manager: (data.manager as string) ?? "",
    contact: (data.contact as string) ?? "",
    createdAt: data.createdAt as string,
  };
}

export async function getCompany(id: string): Promise<Company | null> {
  const snap = await getDoc(doc(companiesCol, id));
  if (!snap.exists()) return null;
  const data = snap.data();
  return { id, name: data.name as string, manager: data.manager ?? "", contact: data.contact ?? "", createdAt: data.createdAt };
}

/**
 * 기업 관리 코드로 보는 기부 내역. 물품 하나마다 어느 길로 갔는지 —
 * 배분기관에 맡겼으면 그 입고 상태와 배분 결과, 시설에 직접 신청했으면 그 신청 상태.
 */
export async function companyHistory(companyId: string) {
  const donations = await listDonationsByCompany(companyId);
  const ids = donations.map((d) => d.id);
  const [intakes, applications] = await Promise.all([
    ids.length ? listIntakesByDonations(ids) : Promise.resolve([]),
    ids.length ? listApplicationsByDonations(ids).then((apps) => Promise.all(apps.map(describeApplication))) : Promise.resolve([]),
  ]);
  return donations.map((d) => ({
    donation: {
      id: d.id,
      itemName: d.itemName,
      category: d.category,
      quantity: d.quantity,
      expiryDate: d.expiryDate,
      createdAt: d.createdAt,
      productImageUrl: d.productImageUrl,
    },
    intakes: intakes
      .filter((i) => i.donationId === d.id)
      .map((i) => ({
        id: i.id,
        hubName: i.hubName,
        status: i.status,
        quantity: i.quantity,
        allocatedQty: i.allocatedQty,
        remainingQty: i.remainingQty,
        facilityCount: new Set(i.allocations.map((a) => a.beneficiaryId)).size,
        rejectReason: i.rejectReason,
      })),
    applications: applications
      .filter((a) => a.donationId === d.id)
      .map((a) => ({
        id: a.id,
        beneficiaryName: a.beneficiary.name,
        quantity: a.quantity,
        status: a.status,
        confirmedDate: a.confirmedDate,
        confirmedSlot: a.confirmedSlot,
      })),
  }));
}

export type CompanyHistory = Awaited<ReturnType<typeof companyHistory>>;
