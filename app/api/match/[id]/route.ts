import { NextResponse } from "next/server";
import { REGIONS } from "@/lib/rules";
import { getDonation, matchNeeds } from "@/lib/store";
import { recommendHub } from "@/lib/hub-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const donation = await getDonation(id);
  if (!donation) {
    return NextResponse.json({ error: "물품을 찾을 수 없습니다" }, { status: 404 });
  }
  const [matches, hub] = await Promise.all([
    matchNeeds(donation.category, donation.itemName, donation.region, donation.genericName),
    recommendHub(donation.region),
  ]);
  return NextResponse.json({
    donation,
    regions: REGIONS.map((r) => r.name),
    matches,
    // 시설을 직접 고르는 대신 맡길 수 있는 가까운 배분기관.
    hub,
  });
}
