import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  IntakeError,
  distributeIntake,
  distributionCandidates,
  getIntake,
} from "@/lib/hub-store";

/** 이 물품을 받을 시설 후보와 제안 수량. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const intake = await getIntake(id);
  if (!intake) return NextResponse.json({ error: "입고 기록을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json({ intake, candidates: await distributionCandidates(intake) });
}

/** 배분 확정. { allocations: [{ needId, qty }], schedule: { method, candidates: [{ date, slot }] } } */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const intake = await distributeIntake(
      id,
      Array.isArray(body.allocations) ? body.allocations : [],
      body.schedule ?? {},
    );
    return NextResponse.json(intake);
  } catch (e) {
    if (e instanceof IntakeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
