import { collection, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { getCompany } from "./company";
import { getIntake } from "./hub-store";
import { type AutoKey, type FormValues, type ReportForm, normalizeForm } from "./report-form";
import { formatQty } from "./rules";
import { getBeneficiary, getDonation } from "./store";

/**
 * 기업 보고 양식(companyForms, 문서 id = 기업 id)과 시설이 쓴 결과(formResponses,
 * 문서 id = 입고id_배분id). 배분 한 건에 결과 하나라 다시 쓰면 덮어쓴다.
 */
const formsCol = collection(db, "companyForms");
const responsesCol = collection(db, "formResponses");

export type StoredForm = ReportForm & { source: "openai" | "sample"; sourceName: string; updatedAt: string };

export async function getCompanyForm(companyId: string): Promise<StoredForm | null> {
  const snap = await getDoc(doc(formsCol, companyId));
  if (!snap.exists()) return null;
  const data = snap.data();
  const form = normalizeForm(data);
  if (!form) return null;
  return { ...form, source: data.source === "openai" ? "openai" : "sample", sourceName: data.sourceName ?? "", updatedAt: data.updatedAt };
}

export async function saveCompanyForm(
  companyId: string,
  form: ReportForm,
  meta: { source: "openai" | "sample"; sourceName: string },
): Promise<StoredForm> {
  const stored: StoredForm = { ...form, ...meta, updatedAt: new Date().toISOString() };
  await setDoc(doc(formsCol, companyId), stored);
  return stored;
}

/** 배분 한 건을 기준으로, 양식의 자동 항목에 들어갈 값과 누가 누구에게 준 건지. */
export async function deliveryContext(intakeId: string, allocationId: string) {
  const intake = await getIntake(intakeId);
  const allocation = intake?.allocations.find((a) => a.id === allocationId);
  if (!intake || !allocation) return null;
  const donation = intake.donationId ? await getDonation(intake.donationId) : undefined;
  const companyId = donation?.companyId ?? null;
  const [company, facility, form] = await Promise.all([
    companyId ? getCompany(companyId) : Promise.resolve(null),
    getBeneficiary(allocation.beneficiaryId),
    companyId ? getCompanyForm(companyId) : Promise.resolve(null),
  ]);
  const received = allocation.schedule?.deliveredAt ?? allocation.schedule?.confirmedDate ?? allocation.at;
  const auto: Record<AutoKey, string> = {
    facilityName: facility?.name ?? allocation.beneficiaryName,
    facilityAddress: facility?.address ?? "",
    companyName: company?.name ?? intake.donorName,
    hubName: intake.hubName,
    itemName: intake.itemName,
    quantity: formatQty(allocation.qty, intake.packing),
    receivedDate: String(received).slice(0, 10),
  };
  return { intake, allocation, companyId, company, form, auto };
}

export type FormResponse = {
  id: string;
  companyId: string;
  intakeId: string;
  allocationId: string;
  beneficiaryId: string;
  /** 쓸 때의 양식을 그대로 남긴다. 기업이 나중에 양식을 바꿔도 이미 낸 문서는 그대로 보인다. */
  form: ReportForm;
  auto: Record<AutoKey, string>;
  values: FormValues;
  submittedAt: string;
};

export function responseId(intakeId: string, allocationId: string) {
  return `${intakeId}_${allocationId}`;
}

export async function saveFormResponse(input: Omit<FormResponse, "id" | "submittedAt">): Promise<FormResponse> {
  const id = responseId(input.intakeId, input.allocationId);
  const data = { ...input, submittedAt: new Date().toISOString() };
  await setDoc(doc(responsesCol, id), data);
  return { id, ...data };
}

export async function getFormResponse(id: string): Promise<FormResponse | null> {
  const snap = await getDoc(doc(responsesCol, id));
  if (!snap.exists()) return null;
  return { id, ...(snap.data() as Omit<FormResponse, "id">) };
}

/** 기업이 받은 결과 문서 목록(사진은 빼고 가볍게). */
export async function listCompanyResponses(companyId: string) {
  const snap = await getDocs(query(responsesCol, where("companyId", "==", companyId)));
  return snap.docs
    .map((d) => {
      const r = d.data() as Omit<FormResponse, "id">;
      return { id: d.id, title: r.form.title, facilityName: r.auto.facilityName, itemName: r.auto.itemName, quantity: r.auto.quantity, submittedAt: r.submittedAt };
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}
