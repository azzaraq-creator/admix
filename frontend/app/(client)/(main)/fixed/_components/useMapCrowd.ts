"use client";

import { type RefObject, useEffect, useState } from "react";

import type { CrowdPlace } from "@/hooks/media";
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoPolygon,
} from "@/lib/kakaoMap";

/** 서울시 실시간 도시데이터의 혼잡도 색(서울시 지도와 같은 4단계). */
export const CROWD_LEVELS: { level: string; color: string; bg: string }[] = [
  { level: "여유", color: "#00b35c", bg: "#e8f8ef" },
  { level: "보통", color: "#f5a400", bg: "#fff6e0" },
  { level: "약간 붐빔", color: "#ff7a2e", bg: "#fff0e7" },
  { level: "붐빔", color: "#e5243b", bg: "#fff1f0" },
];
export const crowdColor = (level: string) =>
  CROWD_LEVELS.find((l) => l.level === level)?.color ?? "#9aa0b4";
export const crowdBg = (level: string) =>
  CROWD_LEVELS.find((l) => l.level === level)?.bg ?? "#f4f4f5";

// 서울시 주요 121장소 영역(백엔드 assets/geo 와 같은 파일) — 표시를 켰을 때 한 번만 받는다.
const PLACES_URL = "/geo/seoul-citydata-places.json";
type Rings = [number, number][][]; // [[경도, 위도], ...]
let ringsPromise: Promise<Map<string, Rings>> | null = null;
function loadRings(): Promise<Map<string, Rings>> {
  ringsPromise ??= fetch(PLACES_URL)
    .then((res) => (res.ok ? res.json() : { places: [] }))
    .then(
      (json: { places: { code: string; rings: Rings }[] }) =>
        new Map(json.places.map((p) => [p.code, p.rings])),
    )
    .catch(() => new Map<string, Rings>());
  return ringsPromise;
}

/** 장소 하나의 표시 — 색 점 + 장소 이름 + 혼잡도. */
function pill(
  place: CrowdPlace,
  onEnter: () => void,
  onLeave: () => void,
): HTMLElement {
  const color = crowdColor(place.level);
  const el = document.createElement("div");
  el.style.cssText = [
    "display:flex",
    "align-items:center",
    "gap:4px",
    "padding:3px 8px 3px 6px",
    "border-radius:999px",
    // 유리 스타일 — 반투명 바탕 + 흐림으로 뒤 지도가 비친다. 혼잡도 색은 점·글자로만(굵은 색 테두리는 유리 느낌을 가린다).
    "background:rgba(255,255,255,0.4)",
    "backdrop-filter:blur(6px) saturate(1.8)",
    "-webkit-backdrop-filter:blur(6px) saturate(1.8)",
    "border:0.5px solid rgba(255,255,255,0.5)",
    "box-shadow:0 2px 8px rgba(0,0,0,0.16)",
    "font-size:11px",
    "line-height:16px",
    "font-weight:600",
    "color:#18181b",
    "white-space:nowrap",
    "cursor:pointer",
  ].join(";");
  el.setAttribute("role", "button");
  el.setAttribute("aria-label", `${place.name} 실시간 인구 ${place.level}`);
  // 마우스는 올리는 즉시, 터치(모바일)는 누를 때 정보를 띄운다.
  el.addEventListener("mouseenter", onEnter);
  el.addEventListener("mouseleave", onLeave);
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    onEnter();
  });

  const dot = document.createElement("span");
  dot.style.cssText = `width:8px;height:8px;border-radius:999px;background:${color};flex-shrink:0`;
  el.appendChild(dot);
  const name = document.createElement("span");
  name.textContent = place.name;
  el.appendChild(name);
  const level = document.createElement("span");
  level.textContent = place.level;
  level.style.color = color;
  el.appendChild(level);
  return el;
}

/**
 * 매체 찾기 지도 "실시간 인구" — 서울시 주요 장소 위치에 실시간 혼잡도를 띄운다.
 * 표시는 매체 핀·말풍선보다 아래(zIndex 0)에 깔아 매체 선택을 가리지 않는다.
 * 마우스를 올리면(모바일은 누르면) 그 장소 범위를 지도에 칠하고, 정보 카드를 띄울 자리(hoverEl)를 돌려준다
 * — 카드 내용은 MapArea 가 React(HeroUI)로 그려 넣는다.
 */
export function useMapCrowd({
  mapRef,
  mapReady,
  places,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  places?: CrowdPlace[] | null;
}) {
  const [hovered, setHovered] = useState<CrowdPlace | null>(null);
  const [hoverEl, setHoverEl] = useState<HTMLDivElement | null>(null);
  const [rings, setRings] = useState<Map<string, Rings> | null>(null);
  const active = !!places?.length;

  // 표시를 켜면 범위 파일을 미리 받아 둔다(처음 마우스를 올릴 때 기다리지 않게).
  useEffect(() => {
    if (!active || rings) return;
    let cancelled = false;
    loadRings().then((loaded) => {
      if (!cancelled) setRings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [active, rings]);

  // 지도 빈 곳을 누르면(모바일) 정보 카드를 닫는다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !active) return;
    const close = () => setHovered(null);
    maps.event.addListener(map, "click", close);
    return () => maps.event.removeListener(map, "click", close);
  }, [mapReady, mapRef, active]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !places?.length) return;
    const overlays: KakaoCustomOverlay[] = places.map((place) => {
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(place.lat, place.lng),
        content: pill(
          place,
          () => setHovered(place),
          () => setHovered((cur) => (cur?.code === place.code ? null : cur)),
        ),
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 0,
      });
      overlay.setMap(map);
      return overlay;
    });
    return () => overlays.forEach((overlay) => overlay.setMap(null));
  }, [mapRef, mapReady, places]);

  // 올린 장소의 범위(반투명) + 정보 카드 자리.
  const shown = active ? hovered : null;
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !shown) return;
    const color = crowdColor(shown.level);
    const polygons: KakaoPolygon[] = (rings?.get(shown.code) ?? []).map(
      (ring) => {
        const polygon = new maps.Polygon({
          path: ring.map(([lng, lat]) => new maps.LatLng(lat, lng)),
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.9,
          fillColor: color,
          fillOpacity: 0.14,
          zIndex: 0,
        });
        polygon.setMap(map);
        return polygon;
      },
    );
    // 카드 자리 — 크기 0인 기준점(장소 위치)에 붙이고, 카드는 CSS로 표시 바로 위 가운데에 띄운다.
    // (카드 내용은 나중에 React가 넣어 카카오가 크기를 0으로 잡으므로 anchor 로는 위치가 어긋난다.)
    // 카드는 마우스를 받지 않아 표시에서 마우스를 떼면 바로 닫힌다.
    const anchor = document.createElement("div");
    anchor.style.cssText =
      "position:relative;width:0;height:0;pointer-events:none";
    const el = document.createElement("div");
    el.style.cssText =
      "position:absolute;left:0;bottom:18px;transform:translateX(-50%);pointer-events:none";
    anchor.appendChild(el);
    const card = new maps.CustomOverlay({
      position: new maps.LatLng(shown.lat, shown.lng),
      content: anchor,
      xAnchor: 0,
      yAnchor: 0,
      zIndex: 20,
    });
    card.setMap(map);
    // 카카오가 카드를 감싸는 바깥 상자도 마우스를 받지 않게 — 받으면 표시 위를 덮어 마우스가 떠난 것으로
    // 잡혀 카드가 닫혔다 열렸다 깜빡인다.
    if (anchor.parentElement) anchor.parentElement.style.pointerEvents = "none";
    setHoverEl(el);
    return () => {
      polygons.forEach((polygon) => polygon.setMap(null));
      card.setMap(null);
      setHoverEl(null);
    };
  }, [mapRef, mapReady, shown, rings]);

  return { hovered: shown, hoverEl };
}
