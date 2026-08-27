import { NextResponse } from "next/server";
import { recommendDates } from "@/lib/store";

/**
 * GET /api/slots/fb1?avail=월:오전,화:오후&maxDate=2026-09-01
 * avail은 "요일:시간대" 쌍을 콤마로 나열한다 — 요일마다 다른 시간대를 표현하기 위함이다.
 * avail이 없으면(빈 문자열) "아무 요일이나 시간대나 괜찮다"는 뜻으로 처리한다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const url = new URL(request.url);
  const availParam = url.searchParams.get("avail") ?? "";
  const donorAvailability: Record<string, string> = {};
  for (const pair of availParam.split(",")) {
    const [day, slot] = pair.split(":");
    if (day && slot) donorAvailability[day] = slot;
  }
  const maxDate = url.searchParams.get("maxDate");

  return NextResponse.json(await recommendDates(id, donorAvailability, maxDate));
}
