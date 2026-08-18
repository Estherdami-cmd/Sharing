import { NextResponse } from "next/server";
import { DEFAULT_REGION } from "@/lib/rules";
import { createDonation } from "@/lib/store";

export async function POST(request: Request) {
  const body = await request.json();
  const { itemName, category } = body;

  if (!itemName || !category) {
    return NextResponse.json({ error: "품목명과 카테고리가 필요합니다" }, { status: 400 });
  }

  const donation = createDonation({
    itemName,
    category,
    // date 인풋은 빈 값을 ""로 준다. 판정 함수가 null만 받도록 여기서 정규화한다.
    expiryDate: body.expiryDate || null,
    region: body.region || DEFAULT_REGION,
  });
  return NextResponse.json(donation);
}
