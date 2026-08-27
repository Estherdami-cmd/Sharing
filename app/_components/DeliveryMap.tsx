"use client";

import { useEffect, useRef, useState } from "react";
import type { FoodBank } from "@/lib/store";

/**
 * 전달 장소를 지도로 보여준다.
 *
 * 네이버 지도(Web Dynamic Map)를 쓴다 — 국내 서비스답게 보이고 한글 표기가 제일
 * 정확하다. Client ID는 아래에 코드로 박아둔다(이유는 그 주석 참고).
 *
 * NCP 콘솔에 도메인이 등록돼 있지 않으면 인증이 실패한다. 그때는 OpenStreetMap
 * 임베드로 떨어진다 — 지도가 아예 사라지는 것보다는 낫다.
 *
 * 길찾기는 네이버 지도로 넘긴다 — 지도와 같은 서비스로 이어지는 게 자연스럽고,
 * 이 링크는 키가 필요 없다.
 */

/**
 * 네이버 클라우드 플랫폼 Maps(Web Dynamic Map) Client ID.
 *
 * 환경변수로 두지 않고 코드에 둔다. lib/firebase.ts의 Firebase 웹 설정과 같은
 * 판단이다 — 웹 지도 키는 브라우저에 그대로 실려 나가는 공개 값이고, 숨겨도
 * 개발자도구를 열면 보인다. **진짜 보안은 NCP 콘솔의 서비스 URL(도메인) 제한**이
 * 하므로, 등록 도메인을 좁게 잡는 것이 중요하다.
 *
 * 환경변수로 뒀을 때 실제로 겪은 문제도 있다. NEXT_PUBLIC_* 은 빌드 시점에 코드로
 * 박히는데 Vercel에 변수가 등록돼 있지 않아, 배포에서는 계속 조용히 OSM으로
 * 떨어졌다. 코드에 두면 팀원 로컬이든 프리뷰든 배포든 설정 없이 같게 동작한다.
 */
const NAVER_CLIENT_ID = "lk1skzrf2b";

const ZOOM = 17;
/** 좌표 주변을 얼마나 넓게 보여줄지(OSM 폴백용). 건물이 구분되는 정도. */
const LNG_SPAN = 0.007;
const LAT_SPAN = 0.0035;

const SDK_ID = "naver-maps-sdk";

declare global {
  interface Window {
    naver?: any;
    /** 네이버가 인증 실패 때 부르는 전역 콜백. 스크립트를 넣기 전에 정의해둬야 한다. */
    navermap_authFailure?: () => void;
  }
}

/** SDK를 한 번만 받는다. 같은 페이지에 지도가 여럿 있어도 스크립트는 하나다. */
function loadNaverSdk(clientId: string): Promise<void> {
  if (window.naver?.maps) return Promise.resolve();
  const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("SDK 로드 실패")));
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SDK_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("SDK 로드 실패"));
    document.head.appendChild(script);
  });
}

function NaverMap({
  lat,
  lng,
  name,
  onFail,
}: {
  lat: number;
  lng: number;
  name: string;
  onFail: () => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    // 인증 실패는 스크립트가 로드된 뒤 이 콜백으로 온다. 그때 OSM으로 갈아탄다.
    window.navermap_authFailure = () => {
      console.error("[DeliveryMap] 네이버 지도 인증 실패 — 도메인 등록을 확인하세요");
      if (!cancelled) onFail();
    };

    loadNaverSdk(NAVER_CLIENT_ID)
      .then(() => {
        if (cancelled || !boxRef.current || !window.naver?.maps) return;
        const { naver } = window;
        const position = new naver.maps.LatLng(lat, lng);
        const map = new naver.maps.Map(boxRef.current, {
          center: position,
          zoom: ZOOM,
          // 폼 안에 있는 지도다. 스크롤 중에 지도가 확대되면 폼을 벗어나기 어렵다.
          scrollWheel: false,
          logoControl: true,
          mapDataControl: false,
        });
        new naver.maps.Marker({ position, map, title: name });
        // 이름표를 함께 띄운다. 좌표만 찍힌 핀은 "여기가 어디지"로 남는다.
        new naver.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;font-weight:700;white-space:nowrap">${name}</div>`,
          borderWidth: 1,
          disableAnchor: false,
        }).open(map, position);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });

    return () => {
      cancelled = true;
    };
  }, [lat, lng, name, onFail]);

  return <div ref={boxRef} className="h-56 w-full" />;
}

function OsmMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const bbox = [lng - LNG_SPAN / 2, lat - LAT_SPAN / 2, lng + LNG_SPAN / 2, lat + LAT_SPAN / 2]
    .map((n) => n.toFixed(6))
    .join(",");
  return (
    <iframe
      src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`}
      title={`${name} 위치 지도`}
      // 폼을 여는 순간 지도까지 받아오면 입력이 늦게 뜬다. 화면에 들어올 때 받는다.
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      className="block h-56 w-full border-0"
    />
  );
}

export default function DeliveryMap({ foodBank }: { foodBank: FoodBank }) {
  const { lat, lng, name } = foodBank;
  const [naverFailed, setNaverFailed] = useState(false);

  // 공공데이터에 좌표가 없던 기관은 제외했지만, 0,0이 들어온 경우까지 방어한다.
  // 지도가 대서양 한복판을 가리키는 것보다 아예 안 보이는 게 낫다.
  if (!lat || !lng) return null;

  /*
   * 네이버 지도 길찾기. 도착지에 이름과 좌표를 직접 넘긴다.
   *
   * 무료급식소 같은 기관은 지도 서비스에 장소로 등록돼 있지 않다 — 이름으로
   * 검색하면 안 나온다. 그래서 장소 ID가 아니라 좌표를 실어 보낸다.
   * 좌표 순서가 경도,위도인 것에 주의(지도 API의 위도,경도와 반대다).
   *
   * 맨 뒤의 이동수단(/-/car)을 빼면 안 된다. 빼면 길찾기 패널이 아예 열리지
   * 않고(입력창 0개) 지도도 엉뚱한 기본 위치를 보여준다 — 실측으로 확인했다.
   * car/transit/walk 중 무엇이든 붙으면 정상이고, 화면에서 탭으로 바꿀 수 있다.
   * 물건을 들고 가는 경우가 많아 자동차를 기본으로 둔다.
   */
  const naverDirections = `https://map.naver.com/p/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/car`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {naverFailed ? (
          <OsmMap lat={lat} lng={lng} name={name} />
        ) : (
          <NaverMap lat={lat} lng={lng} name={name} onFail={() => setNaverFailed(true)} />
        )}
      </div>
      {/*
        밑줄 친 글자 링크는 지도 아래에서 눈에 안 띄고 누를 곳도 좁았다.
        아이콘을 붙인 버튼으로 만든다 — 왼쪽 길찾기 아이콘으로 무슨 동작인지 보이고,
        오른쪽 화살표로 바깥으로 나간다는 걸 알린다.
      */}
      <a
        href={naverDirections}
        target="_blank"
        rel="noreferrer"
        className="flex h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 font-bold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
      >
        <span
          aria-hidden
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            {/* 길찾기 화살표 */}
            <path d="M3 11l19-9-9 19-2-8-8-2z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px]">네이버 지도로 길찾기</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 text-neutral-400"
          aria-hidden
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </a>
    </div>
  );
}
