import { NextResponse } from "next/server";
import { isValidISODate, isValidPhone } from "@/lib/rules";
import { createApplication, describeApplication, getDonation, getNeed, listApplications } from "@/lib/store";

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

  // 기관이 기부자에게 닿는 유일한 통로라, 형식이 어긋난 번호는 여기서 막는다.
  // 클라이언트에서도 같은 규칙으로 검사하지만 이 경로를 우회할 수 있다.
  if (typeof contact !== "string" || !isValidPhone(contact)) {
    return NextResponse.json(
      { error: "연락처 형식을 다시 확인해주세요 (휴대폰 또는 지역번호 포함 유선 번호)" },
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

  // needId는 항상 씨드 데이터라 재배포돼도 그대로 있지만, donationId는 사용자가
  // 방금 등록한 값이라 이 자리에 없을 수 있다(예: 서버리스 인스턴스가 바뀌어 그
  // 인스턴스 메모리엔 없는 경우). 검증 없이 넘어가면 존재하지 않는 물품을 참조하는
  // 신청이 그대로 저장되고, 나중에 그 신청을 보여주려는 화면(기관 관리 등)이
  // donation이 undefined인 채로 필드를 읽다가 그대로 죽는다.
  if (!getDonation(donationId)) {
    return NextResponse.json(
      { error: "등록한 물품 정보를 찾을 수 없어요. 물품 등록부터 다시 시도해주세요" },
      { status: 404 }
    );
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

/**
 * 진행률 계산 등 다른 화면(게시판)도 이 목록을 그대로 받아쓰는데, 그런 곳까지
 * 신청자 전원의 연락처를 한 번에 내려보낼 이유가 없다. 개별 신청은 이미
 * GET /api/applications/:id로 따로 조회할 수 있으니, 목록에서는 항상 가린다.
 *
 * ?contact=01012345678 로 물으면 그 번호로 낸 신청만 연락처를 포함해 돌려준다.
 * 진짜 인증은 아니고("이 번호를 아는 사람"이 곧 자격이다) 회원 없는 서비스의
 * 최소한의 장치다 — 본인 번호를 아는 사람만 자기 신청을 조회하는 정도의 보호.
 */
export async function GET(request: Request) {
  const contactQuery = new URL(request.url).searchParams.get("contact");
  const applications = listApplications().map(describeApplication);

  if (contactQuery) {
    const digits = contactQuery.replace(/\D/g, "");
    return NextResponse.json(applications.filter((app) => app.contact === digits));
  }

  return NextResponse.json(applications.map((app) => ({ ...app, contact: null })));
}
