import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";

/**
 * 기관 관리 코드가 맞는지만 확인한다. 화면이 코드를 받자마자 맞는지 알려주려고 쓴다 —
 * 이게 없으면 수락·연락처 보기 같은 실제 동작을 해봐야 틀린 걸 알게 된다.
 * 코드 없이 열려 있는 로컬 개발에서는 그대로 통과한다.
 */
export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json({ ok: true });
}
