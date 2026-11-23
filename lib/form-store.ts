import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, where } from "firebase/firestore";
import { db } from "./firebase";
import { getCompany } from "./company";
import { getIntake } from "./hub-store";
import { type AutoKey, type FormValues, type ReportForm, normalizeForm } from "./report-form";
import { formatQty } from "./rules";
import { getBeneficiary, getDonation, getNeedView } from "./store";

/**
 * 기업 양식(companyForms, 문서 id = 기업id__양식id)과 시설이 쓴 문서(formResponses,
 * 문서 id = 입고id_배분id_양식id). 기업은 수령 확인서·활용 보고서처럼 양식을 여러 개 둘 수 있고,
 * 배분 한 건마다 양식별로 문서가 하나씩 생긴다. 다시 쓰면 덮어쓴다.
 */
const formsCol = collection(db, "companyForms");
const responsesCol = collection(db, "formResponses");

export const MAX_FORMS_PER_COMPANY = 5;

/*
 * 양식을 여러 개 두기 전에 만든 첫 양식은 문서 id가 기업id 그대로이고, 그때의 시설 문서는
 * 입고id_배분id다. 옮기지 않고 그 양식을 "main"으로 읽는다.
 */
const LEGACY_FORM_ID = "main";
const formDocId = (companyId: string, formId: string) =>
  formId === LEGACY_FORM_ID ? companyId : `${companyId}__${formId}`;

export type StoredForm = ReportForm & {
  id: string;
  companyId: string;
  source: "openai" | "sample";
  sourceName: string;
  updatedAt: string;
};

function toStored(id: string, data: Record<string, unknown>): StoredForm | null {
  const form = normalizeForm(data);
  if (!form) return null;
  return {
    ...form,
    id: (data.formId as string) ?? LEGACY_FORM_ID,
    companyId: (data.companyId as string) ?? id,
    source: data.source === "openai" ? "openai" : "sample",
    sourceName: (data.sourceName as string) ?? "",
    updatedAt: (data.updatedAt as string) ?? "",
    createdAt: (data.createdAt as string) ?? (data.updatedAt as string) ?? "",
  };
}

export async function listCompanyForms(companyId: string): Promise<StoredForm[]> {
  const [snap, legacy] = await Promise.all([
    getDocs(query(formsCol, where("companyId", "==", companyId))),
    getDoc(doc(formsCol, companyId)),
  ]);
  const docs = snap.docs.filter((d) => d.id !== companyId);
  if (legacy.exists()) docs.unshift(legacy as (typeof snap.docs)[number]);
  return docs
    .map((d) => toStored(d.id, d.data()))
    .filter((f): f is StoredForm => !!f)
    .sort((a, b) => (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt));
}

export async function getCompanyForm(companyId: string, formId: string): Promise<StoredForm | null> {
  const snap = await getDoc(doc(formsCol, formDocId(companyId, formId)));
  return snap.exists() ? toStored(snap.id, snap.data()) : null;
}

/** formId가 없으면 새 양식을 만든다. */
export async function saveCompanyForm(
  companyId: string,
  formId: string | null,
  form: ReportForm,
  meta: { source: "openai" | "sample"; sourceName: string },
): Promise<StoredForm> {
  const id = formId ?? Math.random().toString(36).slice(2, 8);
  const existing = formId ? await getCompanyForm(companyId, formId) : null;
  const now = new Date().toISOString();
  const data = { ...form, ...meta, formId: id, companyId, updatedAt: now, createdAt: existing?.createdAt ?? now };
  await setDoc(doc(formsCol, formDocId(companyId, id)), data);
  return { ...data, id } as StoredForm;
}

export async function deleteCompanyForm(companyId: string, formId: string) {
  await deleteDoc(doc(formsCol, formDocId(companyId, formId)));
}

/** 배분 한 건을 기준으로, 양식의 자동 항목에 들어갈 값과 누가 누구에게 준 건지. */
export async function deliveryContext(intakeId: string, allocationId: string) {
  const intake = await getIntake(intakeId);
  const allocation = intake?.allocations.find((a) => a.id === allocationId);
  if (!intake || !allocation) return null;
  const donation = intake.donationId ? await getDonation(intake.donationId) : undefined;
  const companyId = donation?.companyId ?? null;
  const [company, facility, forms, need] = await Promise.all([
    companyId ? getCompany(companyId) : Promise.resolve(null),
    getBeneficiary(allocation.beneficiaryId),
    companyId ? listCompanyForms(companyId) : Promise.resolve([]),
    getNeedView(allocation.needId),
  ]);
  // 받은 때: 전달 완료를 누른 시각 → 확정한 날짜 → 배분한 때 순으로 쓴다.
  const deliveredAt = allocation.schedule?.deliveredAt ?? null;
  const receivedDate = String(deliveredAt ?? allocation.schedule?.confirmedDate ?? allocation.at).slice(0, 10);
  const auto: Record<AutoKey, string> = {
    facilityName: facility?.name ?? allocation.beneficiaryName,
    facilityAddress: facility?.address ?? "",
    facilityCategory: facility?.category ?? "",
    companyName: company?.name ?? intake.donorName,
    hubName: intake.hubName,
    itemName: intake.itemName,
    quantity: formatQty(allocation.qty, intake.packing),
    requestedQty: need ? `${need.targetQty}개` : "",
    expiryDate: intake.expiryDate ?? "",
    donationKind: "현물",
    receivedDate,
    receivedAt: deliveredAt ? kstDateTime(deliveredAt) : receivedDate,
  };
  return { intake, allocation, companyId, company, forms, auto };
}

/** "2026-11-25 14:30" (한국 시각). */
function kstDateTime(iso: string) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600_000);
  return `${d.toISOString().slice(0, 10)} ${d.toISOString().slice(11, 16)}`;
}

export type FormResponse = {
  id: string;
  companyId: string;
  formId: string;
  intakeId: string;
  allocationId: string;
  beneficiaryId: string;
  /** 쓸 때의 양식을 그대로 남긴다. 기업이 나중에 양식을 바꿔도 이미 낸 문서는 그대로 보인다. */
  form: ReportForm;
  auto: Record<AutoKey, string>;
  values: FormValues;
  submittedAt: string;
};

/** 새로 쓰는 문서는 늘 양식 id를 붙인 주소에 둔다(예전 문서를 덮어쓰지 않게). */
export function responseId(intakeId: string, allocationId: string, formId: string) {
  return `${intakeId}_${allocationId}_${formId}`;
}

/**
 * 이 배분·양식으로 이미 낸 문서. 양식 id가 붙은 주소를 먼저 보고, 없으면 예전 주소(입고id_배분id)의
 * 문서가 같은 제목의 양식으로 쓴 것일 때만 그것으로 본다 — 예전 양식 자리가 다른 양식으로 바뀌었을 수 있어서다.
 */
export async function findResponse(intakeId: string, allocationId: string, form: { id: string; title: string }) {
  const current = await getFormResponse(responseId(intakeId, allocationId, form.id));
  if (current) return current;
  const legacy = await getFormResponse(`${intakeId}_${allocationId}`);
  return legacy && legacy.form.title === form.title ? legacy : null;
}

export async function saveFormResponse(input: Omit<FormResponse, "id" | "submittedAt">): Promise<FormResponse> {
  const id = responseId(input.intakeId, input.allocationId, input.formId);
  const data = { ...input, submittedAt: new Date().toISOString() };
  await setDoc(doc(responsesCol, id), data);
  return { id, ...data };
}

export async function getFormResponse(id: string): Promise<FormResponse | null> {
  const snap = await getDoc(doc(responsesCol, id));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<FormResponse, "id">;
  return { id, ...data, formId: data.formId ?? LEGACY_FORM_ID };
}

type ResponseRow = { id: string; formId: string; title: string; facilityName: string; itemName: string; quantity: string; submittedAt: string; allocationId: string };

function toRow(id: string, r: Omit<FormResponse, "id">): ResponseRow {
  return { id, formId: r.formId ?? LEGACY_FORM_ID, title: r.form.title, facilityName: r.auto.facilityName, itemName: r.auto.itemName, quantity: r.auto.quantity, submittedAt: r.submittedAt, allocationId: r.allocationId };
}

/** 기업이 받은 문서 목록(사진은 빼고 가볍게). */
export async function listCompanyResponses(companyId: string): Promise<ResponseRow[]> {
  const snap = await getDocs(query(responsesCol, where("companyId", "==", companyId)));
  return snap.docs.map((d) => toRow(d.id, d.data() as Omit<FormResponse, "id">)).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

/** 맡긴 물품 하나로 시설들이 낸 문서 전부. full이면 사진까지 담은 원문을 준다(모아 인쇄용). */
export async function listIntakeResponses(intakeId: string, full = false) {
  const snap = await getDocs(query(responsesCol, where("intakeId", "==", intakeId)));
  const docs = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FormResponse, "id">) }));
  docs.sort((a, b) => a.auto.facilityName.localeCompare(b.auto.facilityName) || a.form.title.localeCompare(b.form.title));
  return full ? docs : docs.map((r) => toRow(r.id, r));
}
