import { NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/rules";
import { createNeed, getFoodBank, getFoodBanks, listNeeds } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ needs: listNeeds(), foodBanks: getFoodBanks() });
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const { foodBankId, itemName, category, targetQty } = body;

  if (!foodBankId || !itemName || !category || !targetQty) {
    return NextResponse.json(
      { error: "기관·품목명·카테고리·목표 수량을 모두 입력해주세요" },
      { status: 400 }
    );
  }
  if (!getFoodBank(foodBankId)) {
    return NextResponse.json({ error: "기관을 찾을 수 없습니다" }, { status: 404 });
  }
  if (!CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "올바르지 않은 카테고리입니다" }, { status: 400 });
  }

  const targetQtyNum = Number(targetQty);
  if (!Number.isFinite(targetQtyNum)) {
    return NextResponse.json({ error: "목표 수량은 숫자여야 해요" }, { status: 400 });
  }

  const need = createNeed({
    foodBankId,
    itemName,
    category,
    targetQty: Math.max(1, Math.round(targetQtyNum)),
    urgent: Boolean(body.urgent),
    note: body.note ?? "",
  });
  return NextResponse.json(need);
}
