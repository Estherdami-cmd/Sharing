import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/rules";
import { getDonation, matchNeeds } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const donation = getDonation(id);
  if (!donation) {
    return NextResponse.json({ error: "물품을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json({
    donation,
    regions: REGIONS.map((r) => r.name),
    matches: matchNeeds(donation.category, donation.region),
  });
}
