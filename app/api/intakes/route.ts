import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORIES, clampQuantity, isValidISODate } from "@/lib/rules";
import {
  type DonorType,
  IntakeError,
  createIntakeFromDonation,
  createWalkinIntakes,
} from "@/lib/hub-store";

const DONOR_TYPES: DonorType[] = ["company", "individual"];
const MAX_IMAGE_DATA_URL_LENGTH = 3 * 1024 * 1024;
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,/;

function errorResponse(e: unknown) {
  if (e instanceof IntakeError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error("[intakes]", e);
  return NextResponse.json({ error: "처리하지 못했어요. 잠시 뒤 다시 시도해주세요" }, { status: 500 });
}

/**
 * POST /api/intakes
 *  - 기부자(기업·개인)가 "배분기관에 맡기기": { donationId, hubId, donorName, donorType }
 *  - 배분기관이 직접 받아 찍은 물품(관리 코드 필요): { walkin: true, hubId, items, imageUrl }
 */
export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }

  if (body?.walkin) {
    const denied = requireAdmin(request);
    if (denied) return denied;
    const items = Array.isArray(body.items) ? body.items : [];
    const clean = items
      .filter((it: any) => it && typeof it.itemName === "string" && it.itemName.trim())
      .map((it: any) => ({
        itemName: String(it.itemName).trim().slice(0, 60),
        category: CATEGORIES.includes(it.category) ? it.category : "기타",
        quantity: clampQuantity(it.quantity),
        expiryDate:
          typeof it.expiryDate === "string" && isValidISODate(it.expiryDate) ? it.expiryDate : null,
        donorName: typeof it.donorName === "string" ? it.donorName : "",
      }));
    if (clean.length === 0) {
      return NextResponse.json({ error: "등록할 품목이 없어요" }, { status: 400 });
    }
    const imageUrl: string | null = body.imageUrl || null;
    if (imageUrl && (!IMAGE_DATA_URL.test(imageUrl) || imageUrl.length > MAX_IMAGE_DATA_URL_LENGTH)) {
      return NextResponse.json({ error: "이미지 형식이나 용량을 확인해주세요" }, { status: 400 });
    }
    try {
      return NextResponse.json(await createWalkinIntakes(String(body.hubId), clean, imageUrl));
    } catch (e) {
      return errorResponse(e);
    }
  }

  const { donationId, hubId } = body ?? {};
  if (!donationId || !hubId) {
    return NextResponse.json({ error: "물품과 배분기관을 골라주세요" }, { status: 400 });
  }
  const donorType: DonorType = DONOR_TYPES.includes(body.donorType) ? body.donorType : "individual";
  try {
    const intake = await createIntakeFromDonation({
      donationId: String(donationId),
      hubId: String(hubId),
      donorName: typeof body.donorName === "string" ? body.donorName : "",
      donorType,
    });
    return NextResponse.json(intake);
  } catch (e) {
    return errorResponse(e);
  }
}
