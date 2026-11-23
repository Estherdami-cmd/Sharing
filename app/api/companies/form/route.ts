import { NextResponse } from "next/server";
import { findCompanyByCode } from "@/lib/company";
import { MAX_FORMS_PER_COMPANY, deleteCompanyForm, listCompanyForms, saveCompanyForm } from "@/lib/form-store";
import { normalizeForm } from "@/lib/report-form";

async function companyFrom(body: Record<string, unknown>) {
  return findCompanyByCode(typeof body.code === "string" ? body.code : "");
}

/**
 * PUT /api/companies/form { code, formId?, form, source, sourceName }
 * 기업이 확인한 양식을 저장한다. formId가 없으면 새 양식(수령 확인서·활용 보고서처럼 여러 개 둘 수 있다).
 */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const company = await companyFrom(body);
  if (!company) return NextResponse.json({ error: "기업 관리 코드를 확인해주세요" }, { status: 401 });
  const form = normalizeForm(body.form);
  if (!form) return NextResponse.json({ error: "양식에 제목과 항목이 하나 이상 있어야 해요" }, { status: 400 });
  const formId = typeof body.formId === "string" && /^[a-z0-9]{1,12}$/.test(body.formId) ? body.formId : null;
  if (!formId && (await listCompanyForms(company.id)).length >= MAX_FORMS_PER_COMPANY) {
    return NextResponse.json({ error: `양식은 ${MAX_FORMS_PER_COMPANY}개까지 둘 수 있어요` }, { status: 400 });
  }
  const stored = await saveCompanyForm(company.id, formId, form, {
    source: body.source === "openai" ? "openai" : "sample",
    sourceName: typeof body.sourceName === "string" ? body.sourceName.slice(0, 80) : "",
  });
  return NextResponse.json(stored);
}

/** DELETE /api/companies/form { code, formId } — 양식을 뺀다. 이미 받은 문서는 그대로 남는다. */
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const company = await companyFrom(body);
  if (!company) return NextResponse.json({ error: "기업 관리 코드를 확인해주세요" }, { status: 401 });
  if (typeof body.formId !== "string") return NextResponse.json({ error: "뺄 양식을 골라주세요" }, { status: 400 });
  await deleteCompanyForm(company.id, body.formId);
  return NextResponse.json({ ok: true });
}
