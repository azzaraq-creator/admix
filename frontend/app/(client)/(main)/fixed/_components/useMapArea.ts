"use client";

import { type RefObject, useEffect, useState } from "react";

import type { OperatingArea } from "@/hooks/media";
import type { KakaoMap, KakaoPolygon } from "@/lib/kakaoMap";

/** 행정구역 경계(외곽선만, [경도, 위도]) — public/geo/*.json. */
interface RegionShape {
  name: string;
  rings: [number, number][][];
}

// 서울은 구 경계, 그 밖의 시·도는 시·도 경계로 그린다(백엔드 operating_area 의 범위 계산과 같은 단위).
const SEOUL_GU_URL = "/geo/seoul-gu.json";
const SIDO_URL = "/geo/korea-sido.json";

// 이동매체 운행 지역 색 — primary-500 반투명.
const AREA_COLOR = "#7a3fe0";

const geoCache = new Map<string, Promise<RegionShape[] | null>>();

/** 경계 파일은 처음 필요할 때 한 번만 받는다. 실패하면 운행 범위 사각형으로 그린다. */
function loadRegions(url: string): Promise<RegionShape[] | null> {
  let promise = geoCache.get(url);
  if (!promise) {
    promise = fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (json: { districts?: RegionShape[]; provinces?: RegionShape[] } | null) =>
          json?.districts ?? json?.provinces ?? null,
      )
      .catch(() => null);
    geoCache.set(url, promise);
  }
  return promise;
}

function isSeoul(city: string | null): boolean {
  return !!city && city.startsWith("서울");
}

/** 이 운행 지역을 그리는 데 필요한 경계 파일 — 범위를 모르면(전국 등) 그리지 않는다. */
function regionUrl(area: OperatingArea | null | undefined): string | null {
  if (!area?.bounds) return null;
  return isSeoul(area.city) ? SEOUL_GU_URL : SIDO_URL;
}

/** 운행 지역을 그릴 외곽선 목록([위도, 경도]) — 경계를 못 찾으면 운행 범위 사각형. */
function areaRings(
  area: OperatingArea,
  regions: RegionShape[] | null,
): [number, number][][] {
  // 서울: 고른 구(없으면 25개 구 전체). 그 밖: 시·도 하나(구·시·군을 적어도 시·도 전체).
  const picked = !regions
    ? []
    : isSeoul(area.city)
      ? regions.filter(
          (r) => area.districts.length === 0 || area.districts.includes(r.name),
        )
      : regions.filter((r) => r.name === area.city);
  if (picked.length > 0)
    return picked.flatMap((r) =>
      r.rings.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number]),
      ),
    );
  const b = area.bounds;
  if (!b) return [];
  return [
    [
      [b.neLat, b.swLng],
      [b.neLat, b.neLng],
      [b.swLat, b.neLng],
      [b.swLat, b.swLng],
    ],
  ];
}

/**
 * 이동매체 운행 지역을 지도에 반투명 영역으로 그린다(목록에서 이동매체 카드에 마우스를 올렸을 때).
 * 지도는 옮기지 않는다 — 목록이 지도 영역과 겹치는 이동매체만 보여 주므로 영역 일부는 늘 보인다.
 */
export function useMapArea({
  mapRef,
  mapReady,
  area,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  area?: OperatingArea | null;
}) {
  const url = regionUrl(area);
  // 받은 경계 파일 — null이면 받지 못함(사각형으로 그린다).
  const [loaded, setLoaded] = useState<
    Record<string, RegionShape[] | null>
  >({});

  useEffect(() => {
    if (!url || url in loaded) return;
    let cancelled = false;
    loadRegions(url).then((regions) => {
      if (!cancelled) setLoaded((prev) => ({ ...prev, [url]: regions }));
    });
    return () => {
      cancelled = true;
    };
  }, [url, loaded]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !area || !url) return;
    // 경계를 받는 중이면 사각형을 잠깐 그렸다 바꾸지 않고 기다린다.
    if (!(url in loaded)) return;
    const polygons: KakaoPolygon[] = areaRings(area, loaded[url]).map(
      (ring) => {
        const polygon = new maps.Polygon({
          path: ring.map(([lat, lng]) => new maps.LatLng(lat, lng)),
          strokeWeight: 1.5,
          strokeColor: AREA_COLOR,
          strokeOpacity: 0.7,
          fillColor: AREA_COLOR,
          fillOpacity: 0.16,
          // 마커·말풍선보다 아래에 깐다.
          zIndex: 0,
        });
        polygon.setMap(map);
        return polygon;
      },
    );
    return () => polygons.forEach((polygon) => polygon.setMap(null));
  }, [mapRef, mapReady, area, url, loaded]);
}
