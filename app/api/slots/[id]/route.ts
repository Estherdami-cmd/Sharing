import { NextResponse } from "next/server";
import { recommendDates } from "@/lib/store";

/** GET /api/slots/fb1?days=월,수&slot=오전&maxDate=2026-09-01 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days") ?? "";
  const donorDays = daysParam ? daysParam.split(",").filter(Boolean) : [];
  const donorSlot = url.searchParams.get("slot") ?? "상관없음";
  const maxDate = url.searchParams.get("maxDate");

  return NextResponse.json(recommendDates(id, donorDays, donorSlot, maxDate));
}
