import { NextResponse } from "next/server";
import { getFormResponse } from "@/lib/form-store";

/** 시설이 쓴 결과 문서 하나. 주소(긴 id)를 아는 기업·기관이 본다. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await getFormResponse(id);
  if (!response) return NextResponse.json({ error: "문서를 찾을 수 없어요" }, { status: 404 });
  return NextResponse.json(response);
}
