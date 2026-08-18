import { NextResponse } from "next/server";
import {
  describeApplication,
  getApplication,
  requestReceipt,
  updateApplicationStatus,
} from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const application = getApplication(id);
  if (!application) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(describeApplication(application));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const application = body.status
    ? updateApplicationStatus(id, body.status)
    : body.receiptRequested
      ? requestReceipt(id)
      : undefined;

  if (!application) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }
  return NextResponse.json(describeApplication(application));
}
