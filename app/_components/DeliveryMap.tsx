"use client";

import { useEffect, useRef, useState } from "react";
import type { FoodBank } from "@/lib/store";

/**
 * 전달 장소를 지도로 보여주고, 길찾기로 넘긴다.
 *
 * 지도와 길찾기를 모두 카카오맵으로 맞췄다. 네이버 지도를 쓰던 때는 길찾기만
 * 카카오로 나가 서비스가 갈렸고, 네이버 길찾기 URL은 모바일 브라우저에서
 * 통합검색으로 튕겨서 도착지가 전달되지 않았다(실측). 카카오는 모바일에서
 * applink로 넘겨 "앱으로 열기 / 설치 없이 웹으로 보기"를 사용자가 고르게 한다.
 *
 * 인증이 실패하면 OpenStreetMap 임베드로 떨어진다. 도메인 등록이 안 된 환경에서
 * 지도가 아예 사라지는 것보다는 낫다.
 */

/**
 * 카카오 JavaScript 키.
 *
 * 환경변수로 두지 않고 코드에 둔다. lib/firebase.ts의 Firebase 웹 설정과 같은
 * 판단이다 — JavaScript 키는 브라우저에 그대로 실려 나가는 공개 값이고, 숨겨도
 * 개발자도구를 열면 보인다. **진짜 보안은 카카오 콘솔의 사이트 도메인 제한**이다.
 *
 * 주의: REST API 키와 네이티브 앱 키는 성격이 다르다. 그건 비밀 값이니 코드에
 * 넣지 마라. 여기 필요한 건 JavaScript 키뿐이다.
 */
const KAKAO_JS_KEY = "25a61a94d982288cbb2896b8fa72cfd7";

/** 카카오 지도 확대 레벨. 낮을수록 확대. 3이면 건물이 구분된다. */
const ZOOM_LEVEL = 3;

/** SDK가 이 시간 안에 안 뜨면 실패로 보고 OSM으로 넘어간다. */
const SDK_TIMEOUT_MS = 6000;

/** 좌표 주변을 얼마나 넓게 보여줄지(OSM 폴백용). */
const LNG_SPAN = 0.007;
const LAT_SPAN = 0.0035;

const SDK_ID = "kakao-maps-sdk";

declare global {
  interface Window {
    kakao?: any;
  }
}

/** SDK를 한 번만 받는다. 같은 페이지에 지도가 여럿 있어도 스크립트는 하나다. */
function loadKakaoSdk(): Promise<void> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve();

  const existing = document.getElementById(SDK_ID) as HTMLScriptElement | null;
  const script =
    existing ??
    (() => {
      const el = document.createElement("script");
      el.id = SDK_ID;
      el.async = true;
      // autoload=false로 받아두고 kakao.maps.load로 초기화 시점을 우리가 정한다.
      el.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
      document.head.appendChild(el);
      return el;
    })();

  return new Promise((resolve, reject) => {
    const done = () => {
      if (!window.kakao?.maps) {
        reject(new Error("SDK가 로드됐지만 kakao.maps가 없다"));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    if (window.kakao?.maps) {
      done();
      return;
    }
    script.addEventListener("load", done);
    /*
     * 도메인이 등록돼 있지 않으면 카카오는 JS 대신 401 JSON을 준다. 브라우저는
     * 그걸 스크립트로 실행하지 못해 error 이벤트를 낸다 — 그때 여기로 온다.
     * 실제 응답: {"errorType":"AccessDeniedError","message":"domain mismatched! ..."}
     */
    script.addEventListener("error", () =>
      reject(new Error("SDK 로드 실패 — 카카오 콘솔의 사이트 도메인 등록을 확인하세요"))
    );
  });
}

function KakaoMap({
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
    // 스크립트가 응답 없이 매달려 있는 경우까지 폴백이 걸리게 시간 제한을 둔다.
    const timer = setTimeout(() => {
      if (!cancelled) {
        console.error("[DeliveryMap] 카카오 지도 로드가 너무 오래 걸려 OSM으로 대체");
        onFail();
      }
    }, SDK_TIMEOUT_MS);

    loadKakaoSdk()
      .then(() => {
        if (cancelled || !boxRef.current) return;
        clearTimeout(timer);
        const { kakao } = window;
        const position = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(boxRef.current, { center: position, level: ZOOM_LEVEL });
        // 폼 안에 있는 지도다. 스크롤 중에 확대되면 폼을 벗어나기 어렵다.
        map.setZoomable(false);

        const marker = new kakao.maps.Marker({ position, map });
        // 이름표를 함께 띄운다. 좌표만 찍힌 핀은 "여기가 어디지"로 남는다.
        new kakao.maps.InfoWindow({
          content: `<div style="padding:6px 10px;font-size:13px;font-weight:700;white-space:nowrap">${name}</div>`,
        }).open(map, marker);
      })
      .catch((error) => {
        clearTimeout(timer);
        console.error("[DeliveryMap] 카카오 지도 실패 —", error?.message ?? error);
        if (!cancelled) onFail();
      });

    return () => {
      cancelled = true;
      clearTimeout(timer);
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
  const [mapFailed, setMapFailed] = useState(false);

  // 공공데이터에 좌표가 없던 기관은 제외했지만, 0,0이 들어온 경우까지 방어한다.
  // 지도가 대서양 한복판을 가리키는 것보다 아예 안 보이는 게 낫다.
  if (!lat || !lng) return null;

  /*
   * 카카오맵 길찾기. 도착지에 이름과 좌표를 직접 넘긴다.
   *
   * 무료급식소 같은 기관은 지도 서비스에 장소로 등록돼 있지 않다 — "오병이어의 집"을
   * 검색하면 결과가 없다. 그래서 장소 ID가 아니라 좌표를 실어 보낸다.
   * link/map은 위치만 보여주고, link/to는 도착지가 채워진 길찾기를 연다.
   */
  const kakaoDirections = `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {mapFailed ? (
          <OsmMap lat={lat} lng={lng} name={name} />
        ) : (
          <KakaoMap lat={lat} lng={lng} name={name} onFail={() => setMapFailed(true)} />
        )}
      </div>
      {/*
        밑줄 친 글자 링크는 지도 아래에서 눈에 안 띄고 누를 곳도 좁았다.
        아이콘을 붙인 버튼으로 만든다 — 왼쪽 길찾기 아이콘으로 무슨 동작인지 보이고,
        오른쪽 화살표로 바깥으로 나간다는 걸 알린다.
      */}
      <a
        href={kakaoDirections}
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
        <span className="min-w-0 flex-1 truncate text-[14px]">카카오맵으로 길찾기</span>
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
