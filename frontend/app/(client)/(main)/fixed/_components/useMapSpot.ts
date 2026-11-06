"use client";

import { type RefObject, useEffect } from "react";

import type { KakaoMap } from "@/lib/kakaoMap";

/**
 * 검색해서 고른 장소(예: 강남역스타약국) 자리에 빨간 점을 찍는다 — 매체 핀과 헷갈리지 않게 작은 원.
 * 점은 눌러지지 않고(지도 끌기·핀 누르기를 막지 않게) 매체 핀보다 아래 층에 둔다.
 */
export function useMapSpot({
  mapRef,
  mapReady,
  spot,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  spot: { lat: number; lng: number } | null | undefined;
}) {
  const lat = spot?.lat;
  const lng = spot?.lng;
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || lat == null || lng == null) return;
    const el = document.createElement("div");
    el.style.cssText =
      "width:16px;height:16px;border-radius:9999px;background:var(--color-red-500,#ff4d4f);" +
      "border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);box-sizing:border-box;pointer-events:none;";
    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(lat, lng),
      content: el,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 1,
    });
    overlay.setMap(map);
    return () => overlay.setMap(null);
  }, [mapReady, mapRef, lat, lng]);
}
