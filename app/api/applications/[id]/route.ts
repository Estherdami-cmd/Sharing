import { NextResponse } from "next/server";
import {
  describeApplication,
  getApplication,
  requestReceipt,
  updateApplicationStatus,
} from "@/lib/store";
import { isAdminRequest, requireAdmin } from "@/lib/admin-auth";

/**
 * 신청 id는 목록(GET /api/applications)에 그대로 나오므로, id를 안다는 것만으로
 * 연락처를 내주면 목록의 가림이 무의미해진다. 연락처는 기관 관리 코드가 있거나
 * ?contact= 로 그 번호를 이미 아는 경우에만 싣는다. 기부자 완료 화면은 연락처를
 * 쓰지 않으므로 가려도 그대로 동작한다.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const application = await getApplication(id);
  if (!application) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }
  const detail = await describeApplication(application);
  const knownContact = new URL(request.url).searchParams.get("contact")?.replace(/\D/g, "");
  const canSeeContact = isAdminRequest(request) || knownContact === detail.contact;
  return NextResponse.json(canSeeContact ? detail : { ...detail, contact: null });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }

  // 수락·거절은 진행률을 움직이는 기관의 일이다. 영수증 요청은 기부자 본인이
  // 완료 화면에서 하는 일이라 그대로 열어둔다.
  if (body.status) {
    const denied = requireAdmin(request);
    if (denied) return denied;
  }

  const application = body.status
    ? await updateApplicationStatus(
        id,
        body.status,
        body.status === "accepted" ? { date: body.confirmedDate, slot: body.confirmedSlot } : undefined
      )
    : body.receiptRequested
      ? await requestReceipt(id)
      : undefined;

  if (!application) {
    const message =
      body.status === "accepted"
        ? "제안된 날짜 후보 중 하나를 선택해서 수락해주세요"
        : "신청 내역을 찾을 수 없습니다";
    return NextResponse.json({ error: message }, { status: body.status === "accepted" ? 400 : 404 });
  }
  const detail = await describeApplication(application);
  // 영수증 요청 응답에 연락처를 실어 보내면 GET에서 막은 길이 여기로 다시 열린다.
  return NextResponse.json(body.status ? detail : { ...detail, contact: null });
}
