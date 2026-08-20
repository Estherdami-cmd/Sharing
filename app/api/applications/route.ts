import { NextResponse } from "next/server";
import { createApplication, describeApplication, listApplications } from "@/lib/store";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const { donationId, needId, quantity, preferredDate, place, contact } = body;

  if (!donationId || !needId || !quantity || !preferredDate || !place || !contact) {
    return NextResponse.json(
      { error: "수량·날짜·장소·연락처를 모두 입력해주세요" },
      { status: 400 }
    );
  }

  const quantityNum = Number(quantity);
  if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
    return NextResponse.json({ error: "수량은 1 이상의 숫자여야 해요" }, { status: 400 });
  }

  const application = createApplication({
    donationId,
    needId,
    quantity: Math.round(quantityNum),
    preferredDate,
    preferredSlot: body.preferredSlot ?? "",
    place,
    contact,
  });
  if (!application) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(application);
}

export async function GET() {
  return NextResponse.json(listApplications().map(describeApplication));
}
