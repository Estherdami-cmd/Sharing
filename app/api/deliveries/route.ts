import { NextResponse } from "next/server";
import { listIncomingDeliveries } from "@/lib/hub-store";
import { getBeneficiary } from "@/lib/store";

/** 시설로 배분된 물품과 전달 일정. GET /api/deliveries?orgId=ph-65083 */
export async function GET(request: Request) {
  const orgId = new URL(request.url).searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "기관을 골라주세요" }, { status: 400 });
  const org = await getBeneficiary(orgId);
  if (!org) return NextResponse.json({ error: "기관을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json({
    org: { id: org.id, name: org.name },
    deliveries: await listIncomingDeliveries(orgId),
  });
}
