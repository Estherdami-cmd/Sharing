import { NextResponse } from "next/server";
import { isValidISODate } from "@/lib/rules";
import { getDonation, updateDonation } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const donation = await getDonation(id);
  if (!donation) {
    return NextResponse.json({ error: "물품을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(donation);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다" }, { status: 400 });
  }

  if (body.expiryDate && !isValidISODate(body.expiryDate)) {
    return NextResponse.json({ error: "유통기한 형식이 올바르지 않습니다" }, { status: 400 });
  }

  const donation = await updateDonation(id, {
    ...(body.itemName !== undefined && { itemName: body.itemName }),
    ...(body.category !== undefined && { category: body.category }),
    ...(body.region !== undefined && { region: body.region }),
    ...(body.expiryDate !== undefined && { expiryDate: body.expiryDate || null }),
  });

  if (!donation) {
    return NextResponse.json({ error: "물품을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(donation);
}
