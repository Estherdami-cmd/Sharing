import { NextResponse } from "next/server";
import { hubOverview } from "@/lib/hub-store";

/** 배분기관 대시보드: 맡은 시설, 시설들의 요청, 입고 기록. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const overview = await hubOverview(id);
  if (!overview) return NextResponse.json({ error: "배분기관을 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json(overview);
}
