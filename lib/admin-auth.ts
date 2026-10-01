import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/** 기관 관리 화면이 보내는 헤더. 쿼리스트링과 달리 접근 로그·방문 기록에 남지 않는다. */
export const ADMIN_TOKEN_HEADER = "x-admin-token";

/**
 * 기관 관리 동작(신청 수락·거절, 연락처 열람, 요청 등록)을 할 자격이 있는지 본다.
 *
 * 회원이 없는 서비스라 기관마다 계정을 줄 수 없어, 기관들이 함께 쓰는 관리 코드
 * 하나(ADMIN_TOKEN)로 막는다. 운영에서 값이 없으면 열어두지 않고 막는다 — 설정을
 * 빠뜨린 배포가 조용히 누구에게나 열리는 것보다 기관 화면이 안 되는 쪽이 낫다.
 * 로컬 개발에서는 sync-orgs와 같은 판단으로 값이 없으면 그냥 연다.
 */
export function isAdminRequest(req: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected) return process.env.NODE_ENV !== "production";
  const given = req.headers.get(ADMIN_TOKEN_HEADER) ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 자격이 없으면 돌려줄 응답. 있으면 null. */
export function requireAdmin(req: Request): NextResponse | null {
  if (isAdminRequest(req)) return null;
  if (process.env.NODE_ENV === "production" && !process.env.ADMIN_TOKEN) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN이 설정되지 않아 기관 관리 기능을 막았어요." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "기관 관리 코드가 필요해요." }, { status: 401 });
}
