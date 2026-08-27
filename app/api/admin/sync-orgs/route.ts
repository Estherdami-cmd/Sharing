import { NextResponse } from "next/server";
import { SOURCE, fetchPohangOrgs } from "@/lib/opendata";
import { ORG_SNAPSHOT, syncOrgs } from "@/lib/store";

/** 65번의 외부 호출이 있어 2분 가까이 걸린다. 기본 타임아웃으로는 잘린다. */
export const maxDuration = 300;

/**
 * 공공데이터포털에서 기관 목록을 다시 받아 Firestore에 반영한다.
 *
 * ?dryRun=1 을 붙이면 Firestore를 건드리지 않고 받아온 결과만 돌려준다
 * (lib/data/pohang-orgs.json 스냅샷을 이걸로 만든다).
 *
 * 일일 호출 한도가 있는 API라 아무나 부르면 안 된다. 운영에서는 토큰을 요구하고,
 * 로컬 개발에서는 편의상 그냥 열어둔다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  // 커밋된 스냅샷으로만 Firestore를 채운다 — 공공데이터를 안 부르니 빠르고 한도도 안 쓴다.
  // 팀원이 서비스키 없이 DB를 초기화할 때 쓴다.
  const fromSnapshot = url.searchParams.get("source") === "snapshot";

  const expected = process.env.ADMIN_SYNC_TOKEN;
  if (process.env.NODE_ENV === "production") {
    if (!expected) {
      return NextResponse.json(
        { error: "ADMIN_SYNC_TOKEN이 설정되지 않아 동기화를 막았어요." },
        { status: 503 }
      );
    }
    if (url.searchParams.get("token") !== expected) {
      return NextResponse.json({ error: "토큰이 필요해요." }, { status: 401 });
    }
  }

  if (fromSnapshot) {
    const written = await syncOrgs(ORG_SNAPSHOT.orgs);
    return NextResponse.json({
      source: SOURCE,
      from: "lib/data/pohang-orgs.json 스냅샷",
      snapshotFetchedAt: ORG_SNAPSHOT.fetchedAt,
      ...written,
    });
  }

  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      {
        error:
          "DATA_GO_KR_SERVICE_KEY가 없어요. .env.local에 공공데이터포털 서비스키를 넣어주세요.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await fetchPohangOrgs(serviceKey);
    const byCategory = result.orgs.reduce<Record<string, number>>((acc, o) => {
      acc[o.category] = (acc[o.category] ?? 0) + 1;
      return acc;
    }, {});

    if (dryRun) {
      return NextResponse.json(result);
    }

    const written = await syncOrgs(result.orgs);
    return NextResponse.json({
      source: SOURCE,
      fetchedAt: result.fetchedAt,
      scanned: result.scanned,
      skippedNoCoords: result.skippedNoCoords,
      byCategory,
      ...written,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
