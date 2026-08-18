import { NextResponse } from "next/server";
import {
  evaluateShareable,
  findSampleByFileName,
  getSample,
  pickSampleByHash,
  sampleExpiryDate,
} from "@/lib/rules";

/**
 * AI 비전 목업. 실제 Vision API 연동 전까지 쓰지만 랜덤이 아니다.
 * 우선순위: 데모 모드 지정 > 파일명 키워드 > 파일 해시.
 * 해시 경로 덕분에 같은 사진은 항상 같은 결과가 나와 시연 중 결과가 흔들리지 않는다.
 */
export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image");

  if (!(image instanceof File)) {
    return NextResponse.json({ error: "이미지가 없습니다" }, { status: 400 });
  }

  const requested = formData.get("sample");
  const sample =
    (typeof requested === "string" ? getSample(requested) : undefined) ??
    findSampleByFileName(image.name) ??
    pickSampleByHash(image.name, image.size);

  await new Promise((resolve) => setTimeout(resolve, 900));

  const expiryDate = sampleExpiryDate(sample);
  const verdict = evaluateShareable(expiryDate);

  return NextResponse.json({
    itemName: sample.itemName,
    category: sample.category,
    expiryDate,
    confidence: sample.confidence,
    ...verdict,
  });
}
