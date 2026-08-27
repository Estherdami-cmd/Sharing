import { NextResponse } from "next/server";
import { DEFAULT_REGION, isValidISODate } from "@/lib/rules";
import { createDonation } from "@/lib/store";

// 클라이언트가 올릴 때 이미 줄여서 보내지만(RegisterFlow.tsx), 그 경로를 우회한
// 값까지 메모리 저장소에 그대로 쌓이지 않게 여기서도 형태와 크기를 한 번 더 본다.
const MAX_IMAGE_DATA_URL_LENGTH = 2_000_000;

/** 사진은 있으면 좋지만 없다고 등록을 막을 이유는 없다. 이상하면 그냥 없는 걸로 친다. */
function sanitizeImageDataUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("data:image/")) return null;
  if (value.length > MAX_IMAGE_DATA_URL_LENGTH) return null;
  return value;
}

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }
  const { itemName, category } = body;

  if (!itemName || !category) {
    return NextResponse.json({ error: "품목명과 카테고리가 필요합니다" }, { status: 400 });
  }
  if (body.expiryDate && !isValidISODate(body.expiryDate)) {
    return NextResponse.json({ error: "유통기한 형식이 올바르지 않습니다" }, { status: 400 });
  }
  // 상한 밖의 값은 store가 잘라주지만, 숫자가 아닌 건 조용히 1로 바꾸지 않고 되돌려준다.
  if (body.quantity !== undefined && !Number.isFinite(Number(body.quantity))) {
    return NextResponse.json({ error: "수량 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const donation = await createDonation({
    itemName,
    category,
    quantity: body.quantity,
    // date 인풋은 빈 값을 ""로 준다. 판정 함수가 null만 받도록 여기서 정규화한다.
    expiryDate: body.expiryDate || null,
    region: body.region || DEFAULT_REGION,
    productImageUrl: sanitizeImageDataUrl(body.productImageUrl),
    expiryImageUrl: sanitizeImageDataUrl(body.expiryImageUrl),
  });
  return NextResponse.json(donation);
}
