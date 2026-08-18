import { NextResponse } from "next/server";
import { createApplication, describeApplication, listApplications } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json();
  const { donationId, needId, quantity, preferredDate, place, contact } = body;

  if (!donationId || !needId || !quantity || !preferredDate || !place || !contact) {
    return NextResponse.json(
      { error: "수량·날짜·장소·연락처를 모두 입력해주세요" },
      { status: 400 }
    );
  }

  const application = createApplication({
    donationId,
    needId,
    quantity,
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
