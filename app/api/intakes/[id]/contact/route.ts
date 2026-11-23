import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getIntake } from "@/lib/hub-store";
import { getDonorContact } from "@/lib/store";

/**
 * 맡긴 기업의 담당자 연락처. 배분기관이 수거 일정을 잡을 때 쓴다.
 * 입고 기록(/api/intakes/[id])은 기부자도 보는 공개 주소라 연락처를 싣지 않고, 여기서만 준다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const intake = await getIntake(id);
  if (!intake) return NextResponse.json({ error: "입고 기록을 찾을 수 없어요" }, { status: 404 });
  const contact = intake.donationId ? await getDonorContact(intake.donationId) : null;
  return NextResponse.json({ contact });
}
