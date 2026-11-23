import { NextResponse } from "next/server";
import { listIntakeResponses } from "@/lib/form-store";

/**
 * GET /api/intakes/[id]/documents(?full=1)
 * 맡긴 물품 하나로 시설들이 기업 양식에 맞춰 낸 문서들. 맡긴 물품 화면이 목록을 보이고,
 * full이면 사진까지 담아 한꺼번에 인쇄(PDF)할 때 쓴다. 입고 id를 아는 기부자·배분기관이 본다.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const full = new URL(request.url).searchParams.get("full") === "1";
  return NextResponse.json({ documents: await listIntakeResponses(id, full) });
}
