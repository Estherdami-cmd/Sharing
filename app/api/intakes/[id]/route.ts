import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { IntakeError, getIntake, reviewIntake } from "@/lib/hub-store";

/** 맡긴 물품의 상태·결과 보고서. 기부자도 이 주소로 본다(연락처 같은 개인정보는 없다). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intake = await getIntake(id);
  if (!intake) return NextResponse.json({ error: "입고 기록을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json(intake);
}

/** 배분기관의 입고 승인·반려. { action: "approve" | "reject", reason? } */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "승인 또는 반려를 골라주세요" }, { status: 400 });
  }
  try {
    const intake = await reviewIntake(id, body.action, body.reason);
    if (!intake) return NextResponse.json({ error: "입고 기록을 찾을 수 없어요" }, { status: 404 });
    return NextResponse.json(intake);
  } catch (e) {
    if (e instanceof IntakeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
