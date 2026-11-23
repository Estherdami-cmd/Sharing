import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { REGISTER_ORG_CATEGORIES } from "@/lib/hub";
import { REGIONS } from "@/lib/rules";
import { createBeneficiary, getBeneficiaries } from "@/lib/store";

const ALLOWED = new Set<string>([...REGISTER_ORG_CATEGORIES.facility, ...REGISTER_ORG_CATEGORIES.hub]);

/**
 * POST /api/orgs { name, category, address, region }
 * 목록에 없는 기관을 직접 등록한다. 기관 관리 화면과 같은 관리 코드가 있어야 한다 —
 * 아무나 기관을 만들어 필요 목록에 요청을 올리지 못하게.
 */
export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 100) : "";
  const category = typeof body.category === "string" ? body.category : "";
  const region = typeof body.region === "string" ? body.region : "";

  if (!name) return NextResponse.json({ error: "기관 이름을 입력해주세요" }, { status: 400 });
  if (!ALLOWED.has(category)) return NextResponse.json({ error: "기관 종류를 골라주세요" }, { status: 400 });
  if (!address) return NextResponse.json({ error: "주소를 입력해주세요" }, { status: 400 });
  if (!REGIONS.some((r) => r.name === region)) {
    return NextResponse.json({ error: "가까운 동네를 골라주세요" }, { status: 400 });
  }

  // 같은 이름이 이미 있으면 새로 만들지 않고 그 기관으로 안내한다(공백 차이는 같은 이름으로 본다).
  const key = name.replace(/\s/g, "");
  const existing = (await getBeneficiaries()).find((b) => b.name.replace(/\s/g, "") === key);
  if (existing) {
    return NextResponse.json(
      { error: "같은 이름의 기관이 이미 있어요. 목록에서 골라주세요", existingId: existing.id },
      { status: 409 },
    );
  }

  const org = await createBeneficiary({ name, category, address, region });
  return NextResponse.json(org, { status: 201 });
}
