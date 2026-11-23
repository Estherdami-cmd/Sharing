import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { deliveryContext, findResponse, saveFormResponse } from "@/lib/form-store";
import { type FormValues, MAX_PHOTOS, isRecipientInput, missingRequired } from "@/lib/report-form";

type Params = { params: Promise<{ intakeId: string; allocationId: string }> };

/** ?form=양식id. 없으면 그 기업의 첫 양식. */
function pickForm(ctx: NonNullable<Awaited<ReturnType<typeof deliveryContext>>>, request: Request) {
  const want = new URL(request.url).searchParams.get("form");
  return ctx.forms.find((f) => f.id === want) ?? (want ? null : ctx.forms[0] ?? null);
}

/** 시설이 쓸 기업 양식과 자동으로 채운 값, 이미 낸 답(있으면). */
export async function GET(request: Request, { params }: Params) {
  const { intakeId, allocationId } = await params;
  const ctx = await deliveryContext(intakeId, allocationId);
  if (!ctx) return NextResponse.json({ error: "배분 기록을 찾을 수 없어요" }, { status: 404 });
  const form = pickForm(ctx, request);
  if (!form) return NextResponse.json({ error: "이 물품의 기업은 이 양식을 두지 않았어요" }, { status: 404 });
  const existing = await findResponse(intakeId, allocationId, form);
  return NextResponse.json({
    form,
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
  const form = ctx ? pickForm(ctx, request) : null;
  if (!ctx || !form || !ctx.companyId) {
    return NextResponse.json({ error: "작성할 양식이 없어요" }, { status: 404 });
  }
  const body = await request.json().catch(() => ({}));
  const raw = (body.values ?? {}) as Record<string, unknown>;

  // 양식에 있는 칸만, 칸 종류에 맞는 값만 받는다. 자동 항목은 서버가 채운 값을 쓴다.
  const values: FormValues = {};
  for (const f of form.fields) {
    if (!isRecipientInput(f)) continue;
    const v = raw[f.key];
    if (f.kind === "photo") {
      values[f.key] = (Array.isArray(v) ? v : [])
        .filter((p): p is string => typeof p === "string" && p.startsWith("data:image/") && p.length <= MAX_PHOTO_DATA_URL)
        .slice(0, MAX_PHOTOS);
      // 사진마다 붙는 짧은 설명(종이 양식의 "설명" 칸).
      const note = raw[`${f.key}__note`];
      if (typeof note === "string" && note.trim()) values[`${f.key}__note`] = note.trim().slice(0, 100);
    } else if (f.kind === "checks") {
      values[f.key] = (Array.isArray(v) ? v : []).filter((o): o is string => typeof o === "string" && f.options.includes(o));
    } else if (f.kind === "choice") {
      values[f.key] = typeof v === "string" && f.options.includes(v) ? v : "";
    } else if (f.kind === "agree") {
      values[f.key] = v === "동의" ? "동의" : "";
    } else {
      values[f.key] = typeof v === "string" ? v.trim().slice(0, f.kind === "long" ? 1000 : 100) : "";
    }
  }
  const missing = missingRequired(form, values);
  if (missing.length) {
    return NextResponse.json({ error: `${missing.join(", ")}을(를) 채워주세요` }, { status: 400 });
  }
  const saved = await saveFormResponse({
    companyId: ctx.companyId,
    formId: form.id,
    intakeId,
    allocationId,
    beneficiaryId: ctx.allocation.beneficiaryId,
    form,
    auto: ctx.auto,
    values,
  });
  return NextResponse.json({ id: saved.id });
}
