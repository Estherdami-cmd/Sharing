import { NextResponse } from "next/server";
import { createNeed, getFoodBank, getFoodBanks, listNeeds } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ needs: listNeeds(), foodBanks: getFoodBanks() });
}

export async function POST(request: Request) {
  const body = await request.json();
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

  const need = createNeed({
    foodBankId,
    itemName,
    category,
    targetQty: Math.max(1, Number(targetQty)),
    urgent: Boolean(body.urgent),
    note: body.note ?? "",
  });
  return NextResponse.json(need);
}
