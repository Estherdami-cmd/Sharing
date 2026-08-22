import { NextResponse } from "next/server";
import { createApplication, describeApplication, getNeed, listApplications } from "@/lib/store";

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

  const need = getNeed(needId);
  if (!need) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다" }, { status: 404 });
  }

  const quantityNum = Number(quantity);
  if (!Number.isFinite(quantityNum) || quantityNum <= 0) {
    return NextResponse.json({ error: "수량은 1 이상의 숫자여야 해요" }, { status: 400 });
  }

  // 목표가 남아있으면 그만큼으로, 이미 다 찼으면(여유분 받기) 목표 수량만큼으로
  // 상한을 둔다 — 안 그러면 클라이언트를 우회해 비상식적인 수량이 그대로 저장된다.
  const remainingQty = Math.max(0, need.targetQty - need.filledQty);
  const maxQuantity = remainingQty > 0 ? remainingQty : need.targetQty;
  if (quantityNum > maxQuantity) {
    return NextResponse.json(
      { error: `수량은 최대 ${maxQuantity}개까지 신청할 수 있어요` },
      { status: 400 }
    );
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
