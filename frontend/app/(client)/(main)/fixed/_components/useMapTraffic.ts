"use client";

import { type RefObject, useEffect, useRef } from "react";

import type { TrafficLink } from "@/hooks/media";
import type { KakaoMap, KakaoPolyline } from "@/lib/kakaoMap";

/** 서울시 도로 소통 등급 색 — 실시간 인구 혼잡도와 같은 초록·주황·빨강. */
export const TRAFFIC_LEVELS: { level: string; color: string }[] = [
  { level: "원활", color: "#00b35c" },
  { level: "서행", color: "#f5a400" },
  { level: "정체", color: "#e5243b" },
];
export const trafficColor = (level: string | null | undefined) =>
  TRAFFIC_LEVELS.find((l) => l.level === level)?.color ?? "#9aa0b4";

/**
 * 매체 찾기 지도 "도로 현황" — 서울시 실시간 도로 소통 정보(TOPIS)의 도로 구간(링크)을 소통 등급 색 선으로 그린다.
 * 지도를 옮길 때마다 목록이 새로 오지만 이미 그린 구간은 등급이 바뀔 때만 다시 그린다(깜빡이지 않게).
 * 화면 밖으로 나간 구간도 끌 때까지 남겨 둔다. 끄면(links=null) 모두 내린다.
 */
export function useMapTraffic({
  mapRef,
  mapReady,
  links,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  links?: TrafficLink[] | null;
}) {
  const drawnRef = useRef(
    new Map<string, { level: string; line: KakaoPolyline }>(),
  );
  const active = !!links;

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !links) return;
    const drawn = drawnRef.current;
    links.forEach((link) => {
      const cur = drawn.get(link.id);
      if (cur?.level === link.level) return;
      cur?.line.setMap(null);
      const line = new maps.Polyline({
        path: link.path.map(([lat, lng]) => new maps.LatLng(lat, lng)),
        strokeWeight: 5,
        strokeColor: trafficColor(link.level),
        strokeOpacity: 0.85,
        // 매체 핀·장소 범위보다 아래.
        zIndex: -1,
      });
      line.setMap(map);
      drawn.set(link.id, { level: link.level, line });
    });
  }, [mapRef, mapReady, links]);

  useEffect(() => {
    if (!active) return;
    const drawn = drawnRef.current;
    return () => {
      drawn.forEach((d) => d.line.setMap(null));
      drawn.clear();
    };
  }, [active]);
}
