import { NextResponse } from "next/server";
import { deriveGenericNames } from "@/lib/generic-name";
import { backfillGenericNames } from "@/lib/store";

/** 품목명 수십 개를 한 번에 물어보는 호출이라 기본 타임아웃으로는 빠듯하다. */
export const maxDuration = 60;

/**
 * 기존 요청들의 일반명을 채운다. 호출은 품목명 종류당이 아니라 **전체에 한 번**이다.
 *
 *   ?force=1  이미 채워진 것까지 전부 다시 계산 (문자열 규칙으로 들어간 값을 갈아끼울 때)
 *
 * 일반명은 요청이 만들어질 때 채워지므로 평소엔 부를 필요가 없다. 씨드로 들어간
 * 데이터나, 이 기능이 없던 시절에 등록된 요청을 정리할 때 쓴다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const expected = process.env.ADMIN_SYNC_TOKEN;
  if (process.env.NODE_ENV === "production") {
    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_SYNC_TOKEN이 설정되지 않아 막았어요." },
        { status: 503 }
      );
    }
    if (url.searchParams.get("token") !== expected) {
      return NextResponse.json({ error: "토큰이 필요해요." }, { status: 401 });
    }
  }

  try {
    const result = await backfillGenericNames(deriveGenericNames, force);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
