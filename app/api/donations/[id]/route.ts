import { NextResponse } from "next/server";
import { getDonation, updateDonation } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const donation = getDonation(id);
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
  const body = await request.json();

  const donation = updateDonation(id, {
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
