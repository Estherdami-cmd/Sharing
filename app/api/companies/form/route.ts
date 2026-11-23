import { NextResponse } from "next/server";
import { findCompanyByCode } from "@/lib/company";
import { saveCompanyForm } from "@/lib/form-store";
import { normalizeForm } from "@/lib/report-form";

/** PUT /api/companies/form { code, form, source, sourceName } — 기업이 확인한 양식을 저장한다. */
export async function PUT(request: Request) {
  const body = await request.json().catch(() => ({}));
  const company = await findCompanyByCode(typeof body.code === "string" ? body.code : "");
  if (!company) return NextResponse.json({ error: "기업 관리 코드를 확인해주세요" }, { status: 401 });
  const form = normalizeForm(body.form);
  if (!form) return NextResponse.json({ error: "양식에 제목과 항목이 하나 이상 있어야 해요" }, { status: 400 });
  const stored = await saveCompanyForm(company.id, form, {
    source: body.source === "openai" ? "openai" : "sample",
    sourceName: typeof body.sourceName === "string" ? body.sourceName.slice(0, 80) : "",
  });
  return NextResponse.json(stored);
}
