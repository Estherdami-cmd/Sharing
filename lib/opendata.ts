/**
 * 공공데이터포털에서 포항 지역 "기부를 받을 기관"을 가져온다.
 *
 * 이 API에는 카테고리 필터 파라미터가 없다 — ctgry_nm 등을 넘겨도 전부 무시되고
 * 항상 전체(6만여 건)가 온다. 그래서 64,426건을 1,000건씩 65번 받아 우리가 걸러낸다.
 * 한 번에 2분쯤 걸리는 작업이라 사용자 요청 경로에서 부르면 안 된다. 대신
 *   - 평소에는 lib/data/pohang-orgs.json(이 함수로 뽑아 커밋해 둔 스냅샷)을 씨드로 쓰고
 *   - 갱신이 필요할 때만 /api/admin/sync-orgs로 호출한다.
 * 원본 데이터 자체가 2023-08-28 수집 스냅샷이라, 매번 새로 불러도 내용은 같다.
 */

const BASE = "https://apis.data.go.kr/5020000/lvlhMapFcltySttus/getLvlhMapFcltySttus";
const PAGE_SIZE = 1000;

export const SOURCE = {
  provider: "공공데이터포털",
  dataset: "경상북도 포항시_생활 지도 시설 현황",
  datasetUrl: "https://www.data.go.kr/data/15139519/openapi.do",
  /** 원본에 찍혀 있는 수집 시각(collection_dt). 우리가 받은 시각이 아니다. */
  collectedAt: "2023-08-28",
} as const;

/**
 * 화면에 밝히는 출처 목록. 기관 정보는 두 공공데이터에서 오고, 둘 다 표기해야 한다.
 * SOURCE는 이 파일이 실제로 호출하는 API(생활지도)만 가리킨다.
 */
export const SOURCES = [
  {
    dataset: "경상북도 포항시_생활 지도 시설 현황",
    datasetUrl: "https://www.data.go.kr/data/15139519/openapi.do",
    covers: "지역아동센터·무료급식소·요양원",
    collectedAt: "2023-08-28",
  },
  {
    dataset: "경상북도_푸드뱅크 현황",
    datasetUrl: "https://www.data.go.kr/data/15063077/fileData.do",
    covers: "푸드뱅크·푸드마켓",
    collectedAt: null,
  },
] as const;

/** 물품 기부가 실제로 의미 있는 카테고리만 고른다. */
const TARGETS: Record<string, { audience: string; goodsHint: string }> = {
  지역아동센터: { audience: "아동", goodsHint: "학용품·간식·의류·도서" },
  무료급식소: { audience: "식품", goodsHint: "쌀·부식·반찬거리" },
  노인의료시설: { audience: "노인", goodsHint: "생필품·위생용품·간식" },
};

export type Org = {
  id: string;
  name: string;
  category: string;
  address: string;
  region: string;
  lat: number;
  lng: number;
  audience: string;
  goodsHint: string;
};

type RawItem = {
  spm_row: number;
  ctgry_nm: string | null;
  fclty_nm: string | null;
  la: number | null;
  lo: number | null;
  addr: string | null;
};

/**
 * 지역아동센터는 원본 이름이 "그린", "이룸"처럼 한 단어라 그것만으로는 뭔지 알 수 없다.
 * 이미 종류가 드러나는 이름(센터·홈스쿨 등)에는 붙이지 않는다.
 */
function displayName(name: string, category: string): string {
  const n = name.trim();
  if (category !== "지역아동센터") return n;
  if (/센터|홈스쿨|공부방|스쿨/.test(n)) return n;
  return `${n} 지역아동센터`;
}

/** 주소에서 "남구 오천읍"처럼 사람이 읽는 지역 이름을 뽑는다. */
function region(addr: string): string {
  const gu = addr.match(/포항시\s*(남구|북구)/)?.[1];
  const emd =
    addr.match(/([가-힣]{2,5}(?:읍|면))/)?.[1] ??
    addr.match(/\(([가-힣]{2,6}동)/)?.[1] ??
    addr.match(/([가-힣]{2,5}동)\s/)?.[1];
  return [gu, emd].filter(Boolean).join(" ") || "포항시";
}

async function fetchPage(serviceKey: string, pageNo: number) {
  // 키는 이미 URL 인코딩된 형태로 발급된다. 다시 인코딩하면 %2F가 %252F가 되어 죽는다.
  const url = `${BASE}?serviceKey=${serviceKey}&pageNo=${pageNo}&numOfRows=${PAGE_SIZE}&type=json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`공공데이터 API ${res.status} (page ${pageNo})`);
  const json = await res.json();
  const err = json?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) throw new Error(`공공데이터 API 오류: ${err.errMsg} (${err.returnAuthMsg})`);
  const body = json?.response?.body;
  if (!body) throw new Error(`예상과 다른 응답 형태 (page ${pageNo})`);
  const item = body.items?.item;
  return {
    total: body.totalCount as number,
    rows: (Array.isArray(item) ? item : item ? [item] : []) as RawItem[],
  };
}

export type SyncResult = {
  source: typeof SOURCE;
  fetchedAt: string;
  scanned: number;
  skippedNoCoords: number;
  orgs: Org[];
};

export async function fetchPohangOrgs(serviceKey: string): Promise<SyncResult> {
  const first = await fetchPage(serviceKey, 1);
  const rows = [...first.rows];
  const pages = Math.ceil(first.total / PAGE_SIZE);
  for (let p = 2; p <= pages; p++) {
    rows.push(...(await fetchPage(serviceKey, p)).rows);
  }

  let skippedNoCoords = 0;
  const orgs: Org[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const cat = r.ctgry_nm?.trim();
    const target = cat ? TARGETS[cat] : undefined;
    if (!cat || !target) continue;
    const name = r.fclty_nm?.trim();
    const addr = r.addr?.trim();
    if (!name || name === "-" || !addr) continue;
    // 좌표가 없으면 매칭의 거리 계산이 NaN이 된다. 좌표를 지어내는 대신 뺀다.
    if (typeof r.la !== "number" || typeof r.lo !== "number") {
      skippedNoCoords++;
      continue;
    }
    const key = `${cat}|${name}|${addr}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orgs.push({
      id: `ph-${r.spm_row}`,
      name: displayName(name, cat),
      category: cat,
      address: addr,
      region: region(addr),
      lat: r.la,
      lng: r.lo,
      audience: target.audience,
      goodsHint: target.goodsHint,
    });
  }
  orgs.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  return {
    source: SOURCE,
    fetchedAt: new Date().toISOString(),
    scanned: rows.length,
    skippedNoCoords,
    orgs,
  };
}
