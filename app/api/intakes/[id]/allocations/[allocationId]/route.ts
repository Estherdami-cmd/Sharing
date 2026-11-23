import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { IntakeError, type ScheduleAction, updateAllocationSchedule } from "@/lib/hub-store";

const ACTIONS = ["confirm", "counter", "accept-counter", "repropose", "delivered"];

/**
 * 배분 한 건의 전달 일정. 시설(날짜 고르기·다른 날짜 요청·받음)과
 * 배분기관(요청 수락·후보 다시 보내기·전달 완료)이 같은 주소를 쓴다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id, allocationId } = await params;
  const body = await request.json().catch(() => ({}));
  if (!ACTIONS.includes(body?.action)) {
    return NextResponse.json({ error: "알 수 없는 동작이에요" }, { status: 400 });
  }
  try {
    const intake = await updateAllocationSchedule(id, allocationId, body as ScheduleAction);
    return NextResponse.json(intake);
  } catch (e) {
    if (e instanceof IntakeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
