import { NextResponse } from "next/server";
import { findCompanyByCode } from "@/lib/company";
import { readFormDocument } from "@/lib/form-ai";
import { sampleForm } from "@/lib/report-form";

/** 사진·PDF data URL 상한. 휴대폰 사진이나 몇 쪽짜리 PDF면 충분하다. */
const MAX_DATA_URL = 8 * 1024 * 1024;
const ALLOWED = /^data:(image\/(png|jpe?g|webp)|application\/pdf);base64,/;

/**
 * POST /api/companies/form/read { code, file, fileName } 또는 { code, sample: true }
 * 기업 양식을 읽어 항목을 돌려준다. 저장은 하지 않는다 — 기업이 확인하고 저장한다.
 * sample은 AI를 부르지 않는 예시 양식이다(한도에 걸렸을 때·시연용).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const company = await findCompanyByCode(typeof body.code === "string" ? body.code : "");
  if (!company) return NextResponse.json({ error: "기업 관리 코드를 확인해주세요" }, { status: 401 });

  if (body.sample === true) {
    return NextResponse.json({ form: sampleForm(company.name), source: "sample" });
  }

  const file = typeof body.file === "string" ? body.file : "";
  if (!ALLOWED.test(file)) {
    return NextResponse.json({ error: "사진(JPG·PNG) 또는 PDF 파일을 올려주세요" }, { status: 400 });
  }
  if (file.length > MAX_DATA_URL) {
    return NextResponse.json({ error: "파일이 너무 커요. 6MB 이하로 올려주세요" }, { status: 400 });
  }
  const fileName = typeof body.fileName === "string" ? body.fileName.slice(0, 80) : "";
  const outcome = await readFormDocument(file, fileName);
  if (outcome.ok) return NextResponse.json({ form: outcome.form, source: "openai" });

  const messages = {
    no_key: "AI 설정이 없어 읽지 못했어요. 예시 양식으로 시작해 보세요",
    rate_limit: "AI 사용 한도에 걸렸어요. 잠시 뒤 다시 하거나 예시 양식으로 시작해 보세요",
    not_form: "보고 양식으로 읽히지 않았어요. 양식이 잘 보이게 다시 올려주세요",
    error: "양식을 읽지 못했어요. 다시 올리거나 예시 양식으로 시작해 보세요",
  } as const;
  return NextResponse.json(
    { error: messages[outcome.reason], reason: outcome.reason, retryAfterSeconds: outcome.retryAfterSeconds ?? null },
    { status: outcome.reason === "rate_limit" ? 429 : 422 },
  );
}
