import type { FoodBank } from "@/lib/store";

/**
 * 전달 장소를 지도로 보여준다.
 *
 * 지도 제공자로 OpenStreetMap 임베드를 쓴다 — API 키도, 도메인 등록도 필요 없어서
 * 로컬·프리뷰·운영이 전부 같은 코드로 뜬다. 카카오/네이버 지도는 화면이 더
 * 한국적이지만 JS 키와 도메인 등록이 필요해서, 키가 없는 환경에서는 아예 안 뜬다.
 *
 * 대신 길찾기는 카카오맵으로 넘긴다. 실제로 물건을 들고 찾아가는 사람은 익숙한
 * 앱에서 길찾기를 하고, 이 링크는 키가 필요 없다.
 */

/** 좌표 주변을 얼마나 넓게 보여줄지. 건물이 구분되면서 주변 도로가 보이는 정도. */
const LNG_SPAN = 0.007;
const LAT_SPAN = 0.0035;

export default function DeliveryMap({ foodBank }: { foodBank: FoodBank }) {
  const { lat, lng, name } = foodBank;

  // 공공데이터에 좌표가 없던 기관은 제외했지만, 0,0이 들어온 경우까지 방어한다.
  // 지도가 대서양 한복판을 가리키는 것보다 아예 안 보이는 게 낫다.
  if (!lat || !lng) return null;

  const bbox = [lng - LNG_SPAN / 2, lat - LAT_SPAN / 2, lng + LNG_SPAN / 2, lat + LAT_SPAN / 2]
    .map((n) => n.toFixed(6))
    .join(",");
  const embed = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const kakao = `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <iframe
          src={embed}
          title={`${name} 위치 지도`}
          // 폼을 여는 순간 지도까지 받아오면 입력이 늦게 뜬다. 화면에 들어올 때 받는다.
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          // OSM 임베드는 하단에 저작권 표시를 겹쳐 그린다(라이선스라 가릴 수 없다).
          // 좁은 화면에서 두 줄로 늘어나 지도를 많이 덮으므로, 높이를 넉넉히 줘서
          // 표시가 가리는 비중을 줄인다.
          className="block h-56 w-full border-0"
        />
      </div>
      <a
        href={kakao}
        target="_blank"
        rel="noreferrer"
        className="self-start text-[13px] font-bold text-primary-700 underline decoration-primary-700/30 underline-offset-2 hover:text-primary-800"
      >
        카카오맵으로 길찾기
      </a>
    </div>
  );
}
