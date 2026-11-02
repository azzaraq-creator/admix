"use client";

import { type RefObject, useEffect, useRef } from "react";

import type { TrafficVolumeSpot } from "@/hooks/media";
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoPolyline,
} from "@/lib/kakaoMap";

/** 교통량 색 — 실시간 인구·도로 현황(초록·주황·빨강)과 겹치지 않는 파랑. */
export const TRAFFIC_VOLUME_COLOR = "#2f6bff";
const MIN_D = 14;
const MAX_D = 46;
const MIN_W = 2;
const MAX_W = 7;
// 이 축척(카카오 지도 레벨)보다 넓게 보면 선 위 수 표시는 숨긴다(지점끼리 겹쳐 지도를 덮는다).
const LABEL_MAX_LEVEL = 7;

const LINE_ALPHA = 0.5;

/** 통행량 → 원 지름(px). 넓이가 통행량에 비례하게 제곱근으로. 굵기·크기는 지금 보이는 값 가운데 가장 큰 값 기준. */
function circleSize(v: number, max: number): number {
  return Math.round(MIN_D + (MAX_D - MIN_D) * Math.sqrt(v / max));
}

/** 통행량 → 선 굵기(px). */
function lineWeight(v: number, max: number): number {
  return Math.round(MIN_W + (MAX_W - MIN_W) * Math.sqrt(v / max));
}

const maxValue = (spots: TrafficVolumeSpot[]) =>
  Math.max(1, ...spots.map((s) => s.value));

/** 인구 분포 격자 위에 다시 그릴 차량 선(useMapPopGrid realtime) — 카카오 선은 격자 판 아래라 가려진다. */
export function trafficVolumeLines(spots: TrafficVolumeSpot[]) {
  const max = maxValue(spots);
  return spots.flatMap((spot) =>
    spot.paths.map((path) => ({
      path,
      color: TRAFFIC_VOLUME_COLOR,
      width: lineWeight(spot.value, max),
      alpha: LINE_ALPHA,
    })),
  );
}

/** 64128 → "6.4만" — 지점 자리에 적는 짧은 수. */
function shortVolume(v: number): string {
  return v >= 10000 ? `${(v / 10000).toFixed(1)}만` : v.toLocaleString();
}

/** 지점 자리 표시 — 누를 수 없고 마우스도 받지 않는다(지도 끌기·핀 누르기를 막지 않게). */
function marker(spot: TrafficVolumeSpot, max: number, onRoad: boolean) {
  const el = document.createElement("div");
  const base = [
    "pointer-events:none",
    `color:${TRAFFIC_VOLUME_COLOR}`,
    "font-size:10px",
    "font-weight:700",
    "white-space:nowrap",
  ];
  if (onRoad) {
    // 선 위 수 — 흰 바탕 작은 알약.
    el.textContent = shortVolume(spot.value);
    el.style.cssText = [
      ...base,
      "padding:1px 6px",
      "border-radius:9999px",
      "background:#fff",
      `border:1px solid ${TRAFFIC_VOLUME_COLOR}`,
      "line-height:14px",
      "box-shadow:0 1px 3px rgba(0,0,0,0.18)",
    ].join(";");
    return el;
  }
  // 맞는 도로가 없는 지점 — 통행량 크기 원. 큰 원(지름 32px 이상)만 수를 적는다.
  const d = circleSize(spot.value, max);
  if (d >= 32) el.textContent = shortVolume(spot.value);
  el.style.cssText = [
    ...base,
    `width:${d}px`,
    `height:${d}px`,
    "border-radius:9999px",
    `background:${TRAFFIC_VOLUME_COLOR}33`,
    `border:1.5px solid ${TRAFFIC_VOLUME_COLOR}cc`,
    "line-height:1",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "text-shadow:0 0 2px #fff,0 0 2px #fff",
  ].join(";");
  return el;
}

type Drawn = {
  overlay: KakaoCustomOverlay;
  el: HTMLElement;
  lines: KakaoPolyline[];
};

/**
 * 인구 분포 "차량" — 서울시 교통량 지점이 있는 도로(앞뒤 구간, 양방향)를 고른 달 하루 평균 통행량 굵기의
 * 파란 선으로 그리고, 지점 자리에 수(“6.4만”)를 띄운다. 맞는 도로가 없는 지점(paths 비었음)은 통행량 크기의 원.
 * 보기만 한다 — 누르는 동작은 없다. 매체 핀보다 아래(zIndex 0).
 * 인구 분포 격자를 함께 그리면(strong) 카카오 선은 격자 판에 가려 숨기고 격자 위에 다시 그린다(trafficVolumeLines).
 */
export function useMapTrafficVolume({
  mapRef,
  mapReady,
  spots,
  strong = false,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  spots?: TrafficVolumeSpot[] | null;
  /** 인구 분포 격자를 함께 그림 — 카카오 선은 숨긴다 */
  strong?: boolean;
}) {
  const drawnRef = useRef(new Map<string, Drawn>());
  const strongRef = useRef(strong);
  useEffect(() => {
    strongRef.current = strong;
    drawnRef.current.forEach((d) =>
      d.lines.forEach((l) =>
        l.setOptions({ strokeOpacity: strong ? 0 : LINE_ALPHA }),
      ),
    );
  }, [strong]);

  // 달이 바뀌면 굵기·수가 다 바뀌어서 모두 다시 그린다(지점이 140곳뿐이라 가볍다).
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !spots) return;
    const drawn = drawnRef.current;
    const max = maxValue(spots);
    const showLabels = map.getLevel() <= LABEL_MAX_LEVEL;
    spots.forEach((spot) => {
      const onRoad = spot.paths.length > 0;
      const el = marker(spot, max, onRoad);
      if (onRoad && !showLabels) el.style.display = "none";
      const lines = spot.paths.map((path) => {
        const line = new maps.Polyline({
          path: path.map(([lat, lng]) => new maps.LatLng(lat, lng)),
          strokeWeight: lineWeight(spot.value, max),
          strokeColor: TRAFFIC_VOLUME_COLOR,
          strokeOpacity: strongRef.current ? 0 : LINE_ALPHA,
          zIndex: 0,
        });
        line.setMap(map);
        return line;
      });
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(spot.lat, spot.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 0,
      });
      overlay.setMap(map);
      // 카카오가 감싸는 바깥 상자도 마우스를 받지 않게.
      if (el.parentElement) el.parentElement.style.pointerEvents = "none";
      drawn.set(spot.num, { overlay, el, lines });
    });
    // 넓게 보면 선 위 수 표시를 숨긴다(원은 그대로).
    const onZoom = () => {
      const show = map.getLevel() <= LABEL_MAX_LEVEL;
      drawn.forEach((d) => {
        if (d.lines.length) d.el.style.display = show ? "" : "none";
      });
    };
    maps.event.addListener(map, "zoom_changed", onZoom);
    return () => {
      maps.event.removeListener(map, "zoom_changed", onZoom);
      drawn.forEach((d) => {
        d.overlay.setMap(null);
        d.lines.forEach((l) => l.setMap(null));
      });
      drawn.clear();
    };
  }, [mapRef, mapReady, spots]);
}
