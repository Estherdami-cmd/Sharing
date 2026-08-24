import { NextResponse } from "next/server";
import {
  describeApplication,
  getApplication,
  requestReceipt,
  updateApplicationStatus,
} from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const application = getApplication(id);
  if (!application) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(describeApplication(application));
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

  const application = body.status
    ? updateApplicationStatus(
        id,
        body.status,
        body.status === "accepted" ? { date: body.confirmedDate, slot: body.confirmedSlot } : undefined
      )
    : body.receiptRequested
      ? requestReceipt(id)
      : undefined;

  if (!application) {
    const message =
      body.status === "accepted"
        ? "제안된 날짜 후보 중 하나를 선택해서 수락해주세요"
        : "신청 내역을 찾을 수 없습니다";
    return NextResponse.json({ error: message }, { status: body.status === "accepted" ? 400 : 404 });
  }
  return NextResponse.json(describeApplication(application));
}
