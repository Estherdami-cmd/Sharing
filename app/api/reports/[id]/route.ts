import { NextResponse } from "next/server";
import { findCompanyByCode } from "@/lib/company";
import { fillCompanyValues, getFormResponse } from "@/lib/form-store";

/** 시설이 쓴 결과 문서 하나. 주소(긴 id)를 아는 기업·기관이 본다. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getFormResponse(id);
  if (!response) return NextResponse.json({ error: "문서를 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json(response);
}

/**
 * PATCH /api/reports/[id] { code, values } — 기업이 받은 문서에서 자기 칸을 채운다.
 * 사업자등록번호·단가·금액처럼 시설은 모르고 기업만 아는 값을 문서를 받은 뒤에 넣는다.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const company = await findCompanyByCode(typeof body.code === "string" ? body.code : "");
  if (!company) return NextResponse.json({ error: "기업 관리 코드를 확인해주세요" }, { status: 401 });
  const updated = await fillCompanyValues(id, company.id, (body.values ?? {}) as Record<string, unknown>);
  if (!updated) return NextResponse.json({ error: "이 기업이 받은 문서가 아니에요" }, { status: 404 });
  return NextResponse.json(updated);
}
