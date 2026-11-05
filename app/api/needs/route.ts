import { NextResponse } from "next/server";
import { CATEGORIES, clampTargetQty } from "@/lib/rules";
import { deriveGenericNames } from "@/lib/generic-name";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createNeed,
  getBeneficiary,
  getBeneficiaries,
  listNeeds,
} from "@/lib/store";

/** data URL은 base64라 원본의 4/3배가 된다. Firestore 문서 하나가 너무 커지지 않게 막아둔다. */
const MAX_IMAGE_DATA_URL_LENGTH = 3 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 한국 시간 기준 오늘 날짜("YYYY-MM-DD"). 서버는 UTC로 돌아서 그냥 쓰면 오전 9시 전엔 하루 밀린다. */
function todayInKorea() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

export async function GET() {
  return NextResponse.json({
    needs: await listNeeds(),
    beneficiaries: await getBeneficiaries(),
  });
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다" },
      { status: 400 },
    );
  }
  const { beneficiaryId, itemName, category, targetQty } = body;

  if (!beneficiaryId || !itemName || !category || !targetQty) {
    return NextResponse.json(
      { error: "기관·품목명·카테고리·목표 수량을 모두 입력해주세요" },
      { status: 400 },
    );
  }
  if (!(await getBeneficiary(beneficiaryId))) {
    return NextResponse.json(
      { error: "기관을 찾을 수 없습니다" },
      { status: 404 },
    );
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json(
      { error: "올바르지 않은 카테고리입니다" },
      { status: 400 },
    );
  }

  const targetQtyNum = Number(targetQty);
  if (!Number.isFinite(targetQtyNum)) {
    return NextResponse.json(
      { error: "목표 수량은 숫자여야 해요" },
      { status: 400 },
    );
  }

  const imageUrl: string | null = body.imageUrl || null;
  if (imageUrl) {
    if (!IMAGE_DATA_URL.test(imageUrl)) {
      return NextResponse.json(
        { error: "이미지 형식이 올바르지 않습니다" },
        { status: 400 },
      );
    }
    if (imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json(
        { error: "이미지 용량이 너무 커요" },
        { status: 400 },
      );
    }
  }

  /*
   * 일반명은 여기서 한 번만 뽑는다. 매칭 경로에서 부르면 화면을 열 때마다 API를
   * 쓰게 된다. 요청 등록은 기관이 어쩌다 하는 일이라 호출량이 문제되지 않는다.
   * 실패하면 문자열 규칙으로 채워지므로 등록 자체가 막히지는 않는다.
   */
  // 모집 마감일은 선택 항목이다. 보내지 않으면 null로 두고, 보냈다면 형식과 날짜를 확인한다.
  const deadline: string | null = body.deadline || null;
  if (deadline) {
    if (!DATE_ONLY.test(deadline) || Number.isNaN(Date.parse(deadline))) {
      return NextResponse.json(
        { error: "모집 마감일 형식이 올바르지 않습니다" },
        { status: 400 },
      );
    }
    if (deadline < todayInKorea()) {
      return NextResponse.json(
        { error: "모집 마감일은 오늘 이후로 정해주세요" },
        { status: 400 },
      );
    }
  }

  const generics = await deriveGenericNames([itemName]);

  const need = await createNeed({
    beneficiaryId,
    itemName,
    category,
    targetQty: clampTargetQty(targetQtyNum),
    note: body.note ?? "",
    imageUrl,
    genericName: generics.get(itemName) ?? null,
    deadline,
  });
  return NextResponse.json(need);
}
