import { NextResponse } from "next/server";
import { listIncomingDeliveries } from "@/lib/hub-store";
import { deliveryContext, getFormResponse, responseId } from "@/lib/form-store";
import { getBeneficiary } from "@/lib/store";

/** 시설로 배분된 물품과 전달 일정. GET /api/deliveries?orgId=ph-65083 */
export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "기관을 골라주세요" }, { status: 400 });
  const org = await getBeneficiary(orgId);
  if (!org) return NextResponse.json({ error: "기관을 찾을 수 없어요" }, { status: 404 });
  const rows = await listIncomingDeliveries(orgId);
  // 기업 물품이고 그 기업이 보고 양식을 올렸으면, 시설이 그 양식으로 결과를 쓸 수 있다.
  const deliveries = await Promise.all(
    rows.map(async (row) => {
      const ctx = await deliveryContext(row.intakeId, row.allocation.id);
      if (!ctx?.form) return { ...row, report: null };
      const done = await getFormResponse(responseId(row.intakeId, row.allocation.id));
      return { ...row, report: { companyName: ctx.auto.companyName, formTitle: ctx.form.title, responseId: done?.id ?? null } };
    }),
  );
  return NextResponse.json({ org: { id: org.id, name: org.name }, deliveries });
}
