import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deliveryContext, getFormResponse, responseId, saveFormResponse } from "@/lib/form-store";
import { type FormValues, MAX_PHOTOS, missingRequired } from "@/lib/report-form";

type Params = { params: Promise<{ intakeId: string; allocationId: string }> };

/** 시설이 쓸 기업 양식과 자동으로 채운 값, 이미 낸 답(있으면). */
export async function GET(_req: Request, { params }: Params) {
  const { intakeId, allocationId } = await params;
  const ctx = await deliveryContext(intakeId, allocationId);
  if (!ctx) return NextResponse.json({ error: "배분 기록을 찾을 수 없어요" }, { status: 404 });
  if (!ctx.form) return NextResponse.json({ error: "이 물품의 기업은 아직 보고 양식을 올리지 않았어요" }, { status: 404 });
  const existing = await getFormResponse(responseId(intakeId, allocationId));
  return NextResponse.json({
    form: ctx.form,
    auto: ctx.auto,
    facilityId: ctx.allocation.beneficiaryId,
    companyName: ctx.auto.companyName,
    response: existing ? { id: existing.id, values: existing.values, submittedAt: existing.submittedAt } : null,
  });
}

const MAX_PHOTO_DATA_URL = 400_000;

/** 시설이 양식을 다 써서 낸다. 기관 관리 코드가 있어야 한다. */
export async function POST(request: Request, { params }: Params) {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { intakeId, allocationId } = await params;
  const ctx = await deliveryContext(intakeId, allocationId);
  if (!ctx?.form || !ctx.companyId) {
    return NextResponse.json({ error: "작성할 양식이 없어요" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const raw = (body.values ?? {}) as Record<string, unknown>;

  // 양식에 있는 칸만, 칸 종류에 맞는 값만 받는다. 자동 항목은 서버가 채운 값을 쓴다.
  const values: FormValues = {};
  for (const f of ctx.form.fields) {
    if (f.auto) continue;
    const v = raw[f.key];
    if (f.kind === "photo") {
      const photos = (Array.isArray(v) ? v : [])
        .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/") && p.length <= MAX_PHOTO_DATA_URL)
        .slice(0, MAX_PHOTOS);
      values[f.key] = photos;
    } else {
      values[f.key] = typeof v === "string" ? v.trim().slice(0, f.kind === "long" ? 1000 : 100) : "";
    }
  }
  const missing = missingRequired(ctx.form, values);
  if (missing.length) {
    return NextResponse.json({ error: `${missing.join(", ")}을(를) 채워주세요` }, { status: 400 });
  }
  const saved = await saveFormResponse({
    companyId: ctx.companyId,
    intakeId,
    allocationId,
    beneficiaryId: ctx.allocation.beneficiaryId,
    form: ctx.form,
    auto: ctx.auto,
    values,
  });
  return NextResponse.json({ id: saved.id });
}
