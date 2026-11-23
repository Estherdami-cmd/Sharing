import { NextResponse } from "next/server";
import { companyHistory, findCompanyByCode } from "@/lib/company";

/**
 * POST /api/companies/lookup { code }
 * 기업 관리 코드로 그 기업 정보와 지금까지의 기부 내역을 본다. 코드가 주소창·접근 기록에
 * 남지 않게 GET 쿼리 대신 본문으로 받는다.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code : "";
  const company = await findCompanyByCode(code);
  if (!company) {
    return NextResponse.json({ error: "이 관리 코드로 등록된 기업이 없어요" }, { status: 404 });
  }
  const history = await companyHistory(company.id);
  return NextResponse.json({
    company: { name: company.name, manager: company.manager, contact: company.contact },
    history,
  });
}
