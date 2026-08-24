import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/rules";
import { createApplication, describeApplication, getNeed, listApplications } from "@/lib/store";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const { donationId, needId, quantity, candidateDates, place, contact } = body;

  if (
    !donationId ||
    !needId ||
    !quantity ||
    !Array.isArray(candidateDates) ||
    candidateDates.length === 0 ||
    !place ||
    !contact
  ) {
    return NextResponse.json(
      { error: "수량·날짜 후보·장소·연락처를 모두 입력해주세요" },
      { status: 400 }
    );
  }

  // 후보 날짜 중 형식이 올바른 것만 남긴다 — 클라이언트를 우회한 이상한 값이 그대로 저장되지 않게.
  const normalizedCandidates = candidateDates
    .filter(
      (c: any) => c && typeof c.date === "string" && typeof c.slot === "string" && isValidISODate(c.date)
    )
    .map((c: any) => ({ date: c.date, slot: c.slot }));

  if (normalizedCandidates.length === 0) {
    return NextResponse.json({ error: "유효한 날짜 후보가 없어요" }, { status: 400 });
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
    candidateDates: normalizedCandidates,
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
