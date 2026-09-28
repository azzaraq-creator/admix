"use client";

import { type RefObject, useEffect, useRef } from "react";

import {
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMarker,
  type KakaoMarkerImage,
  type KakaoMaps,
} from "@/lib/kakaoMap";

import type { MapCluster, MapMarker, MoveTarget } from "./mapTypes";

const MARKER_SIZE = { width: 40, height: 40 };
const MARKER_ANCHOR = { x: 20, y: 16 };

const MARKER_SRC: Record<string, string> = {
  "전광판&빌보드": "/markers/billboard.svg",
  지하철: "/markers/subway.svg",
  공항: "/markers/airport.svg",
  "기차&기차역": "/markers/train.svg",
  기차역: "/markers/train-station.svg",
  정류장: "/markers/bus-stop.svg",
  "주거&사무공간": "/markers/residential-office.svg",
  "쇼핑몰&마트": "/markers/mart.svg",
  엔터테인먼트: "/markers/entertainment.svg",
  "생활&편의시설": "/markers/amenities.svg",
  기타: "/markers/etc.svg",
};

const CATEGORY_TO_ITEM: Record<string, string> = {
  "전광판/빌보드": "전광판&빌보드",
  지하철: "지하철",
  "공항/기차": "공항",
  "쇼핑몰/마트": "쇼핑몰&마트",
  정류장: "정류장",
  버스: "정류장",
  엔터테인먼트: "엔터테인먼트",
  "주거/사무공간": "주거&사무공간",
  "생활 편의시설": "생활&편의시설",
};

function markerSrc(categoryLarge?: string | null, focused = false): string {
  const item = (categoryLarge && CATEGORY_TO_ITEM[categoryLarge]) || "기타";
  const file = MARKER_SRC[item] ?? MARKER_SRC["기타"];
  // 포커스 변형: 바깥 링 흰색 (public/markers/focus/*.svg). 크기는 기본과 같다.
  const path = focused ? file.replace("/markers/", "/markers/focus/") : file;
  return encodeURI(path);
}

function markerImageFor(
  maps: KakaoMaps,
  cache: Record<string, KakaoMarkerImage>,
  categoryLarge: string | null | undefined,
  focused: boolean,
): KakaoMarkerImage {
  const src = markerSrc(categoryLarge, focused);
  if (!cache[src]) {
    cache[src] = new maps.MarkerImage(
      src,
      new maps.Size(MARKER_SIZE.width, MARKER_SIZE.height),
      { offset: new maps.Point(MARKER_ANCHOR.x, MARKER_ANCHOR.y) },
    );
  }
  return cache[src];
}

const GROUP_PRECISION = 1e4; // 소수 4자리 ≈ 11m — 좌표 겹침 그룹 키

function groupKeyOf(lat: number, lng: number): string {
  return `${Math.round(lat * GROUP_PRECISION)},${Math.round(
    lng * GROUP_PRECISION,
  )}`;
}

// 숫자핀(클러스터·겹침 그룹) 공통 디자인 — public/markers/cluster.svg(기본)와
// focus/cluster.svg(선택)를 그대로 옮긴 것. SVG엔 숫자가 박혀 있어 이미지로는 못 쓰고
// 같은 색·테두리를 CSS로 그린다. 기본은 보라 원 + 흰 숫자(테두리·그림자 없음),
// 선택은 흰 원 + 보라 테두리·숫자(단일 핀 포커스와 같이 크기는 그대로).
// 숫자 크기·테두리 두께는 SVG(원 지름 약 29 : 숫자 12 : 선 1.6) 비율로 핀 크기에 맞춘다.
function numberPinCss(size: number, selected: boolean): string {
  const base = `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;font-size:${Math.round(size * 0.42)}px;font-weight:600;letter-spacing:-0.5px;box-sizing:border-box;cursor:pointer;`;
  return selected
    ? `${base}background:#ffffff;border:${(size * 0.05).toFixed(1)}px solid #a33bd1;color:#a33bd1;`
    : `${base}background:#a33bd1;color:#ffffff;`;
}

export function useMapMarkers({
  mapRef,
  mapReady,
  programmaticMoveRef,
  markerObjsRef,
  markers,
  clusters,
  selectedGroup,
  autoFit,
  focusId,
  focusOffsetX,
  focusCenter,
  moveTarget,
  onMarkerClick,
  onClusterClick,
  onGroupClick,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  programmaticMoveRef: RefObject<boolean>;
  markerObjsRef: RefObject<{ marker: KakaoMarker; data: MapMarker }[]>;
  markers: MapMarker[];
  clusters: MapCluster[];
  selectedGroup?: MapMarker[] | null;
  autoFit: boolean;
  focusId?: string;
  focusOffsetX: number;
  focusCenter: boolean;
  moveTarget?: MoveTarget | null;
  onMarkerClick?: (id: string) => void;
  onClusterClick?: (cluster: MapCluster) => void;
  onGroupClick?: (markers: MapMarker[]) => void;
}) {
  const clusterOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const groupOverlaysRef = useRef<
    {
      overlay: KakaoCustomOverlay;
      el: HTMLDivElement;
      key: string;
      size: number;
      memberIds: string[];
      lat: number;
      lng: number;
    }[]
  >([]);
  const imageCacheRef = useRef<Record<string, KakaoMarkerImage>>({});
  const shownFocusRef = useRef<string | undefined>(undefined);
  const focusedGroupKeyRef = useRef<string | undefined>(undefined);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onClusterClickRef = useRef(onClusterClick);
  const onGroupClickRef = useRef(onGroupClick);

  const selectedGroupKey =
    selectedGroup && selectedGroup.length > 0
      ? groupKeyOf(selectedGroup[0].lat, selectedGroup[0].lng)
      : undefined;
  const selectedGroupKeyRef = useRef(selectedGroupKey);

  useEffect(() => {
    onMarkerClickRef.current = onMarkerClick;
    onClusterClickRef.current = onClusterClick;
    onGroupClickRef.current = onGroupClick;
    selectedGroupKeyRef.current = selectedGroupKey;
  });

  // 마커 생성 + 범위 맞춤 — markers 변경 시에만 (포커스 변경으로는 재실행 안 됨)
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    markerObjsRef.current.forEach(({ marker }) => marker.setMap(null));
    markerObjsRef.current = [];
    groupOverlaysRef.current.forEach((o) => o.overlay.setMap(null));
    groupOverlaysRef.current = [];
    shownFocusRef.current = undefined;
    focusedGroupKeyRef.current = undefined;

    const valid = markers.filter(
      (m) => typeof m.lat === "number" && typeof m.lng === "number",
    );
    if (valid.length === 0) return;

    // 거의 같은 위치(≈11m)의 마커를 그룹핑 → 최대 확대에서도 겹치는 핀을 하나로.
    const groups = new Map<string, MapMarker[]>();
    valid.forEach((m) => {
      const key = `${Math.round(m.lat * GROUP_PRECISION)},${Math.round(
        m.lng * GROUP_PRECISION,
      )}`;
      const arr = groups.get(key);
      if (arr) arr.push(m);
      else groups.set(key, [m]);
    });

    const bounds = new maps.LatLngBounds();
    groups.forEach((members, key) => {
      const first = members[0];
      const pos = new maps.LatLng(first.lat, first.lng);
      bounds.extend(pos);
      if (members.length === 1) {
        const m = first;
        const marker = new maps.Marker({
          position: pos,
          image: markerImageFor(
            maps,
            imageCacheRef.current,
            m.categoryLarge,
            false,
          ),
          title: m.name,
          zIndex: 1,
        });
        marker.setMap(map);
        maps.event.addListener(marker, "click", () =>
          onMarkerClickRef.current?.(m.id),
        );
        markerObjsRef.current.push({ marker, data: m });
      } else {
        // 겹친 마커 → 카운트 배지. 클릭 시 그 매체들을 리스트 팝업으로.
        const size =
          members.length >= 100 ? 48 : members.length >= 10 ? 44 : 40;
        const selected = key === selectedGroupKeyRef.current;
        const el = document.createElement("div");
        el.style.cssText = numberPinCss(size, selected);
        el.textContent = String(members.length);
        el.addEventListener("click", () => onGroupClickRef.current?.(members));
        const overlay = new maps.CustomOverlay({
          position: pos,
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: selected ? 8 : 6,
          clickable: true,
        });
        overlay.setMap(map);
        groupOverlaysRef.current.push({
          overlay,
          el,
          key,
          size,
          memberIds: members.map((mm) => mm.id),
          lat: first.lat,
          lng: first.lng,
        });
      }
    });

    if (!autoFit) return;
    if (valid.length === 1) {
      map.setCenter(new maps.LatLng(valid[0].lat, valid[0].lng));
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
    }
  }, [markers, mapReady, autoFit, mapRef, markerObjsRef]);

  // 검색어 지오코딩 결과로 지도 이동(프로그램 이동 → 사용자 이동 아님으로 표시).
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !moveTarget) return;
    programmaticMoveRef.current = true;
    if (moveTarget.fitBounds) {
      const fb = moveTarget.fitBounds;
      const bounds = new maps.LatLngBounds();
      bounds.extend(new maps.LatLng(fb.swLat, fb.swLng));
      bounds.extend(new maps.LatLng(fb.neLat, fb.neLng));
      map.setBounds(bounds);
    } else {
      map.setCenter(new maps.LatLng(moveTarget.lat, moveTarget.lng));
      if (moveTarget.level != null) map.setLevel(moveTarget.level);
    }
  }, [moveTarget, mapReady, mapRef, programmaticMoveRef]);

  // 클러스터 버블 — CustomOverlay. 클릭 시 줌인 → idle → 재조회로 분해.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    clusterOverlaysRef.current.forEach((o) => o.setMap(null));
    clusterOverlaysRef.current = [];

    clusters.forEach((c) => {
      const size = c.count >= 100 ? 60 : c.count >= 10 ? 48 : 40;
      const el = document.createElement("div");
      el.style.cssText = numberPinCss(size, false);
      el.textContent = String(c.count);
      el.addEventListener("click", () => {
        programmaticMoveRef.current = true;
        map.setCenter(new maps.LatLng(c.lat, c.lng));
        map.setLevel(Math.max(1, map.getLevel() - 2));
        onClusterClickRef.current?.(c);
      });
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(c.lat, c.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5,
        clickable: true,
      });
      overlay.setMap(map);
      clusterOverlaysRef.current.push(overlay);
    });
  }, [clusters, mapReady, mapRef, programmaticMoveRef]);

  // 겹침 그룹 배지 선택(팝업 열림 또는 포커스) — 재생성 없이 흰링+확대만 토글.
  useEffect(() => {
    for (const g of groupOverlaysRef.current) {
      const sel =
        g.key === selectedGroupKey || g.key === focusedGroupKeyRef.current;
      g.el.setAttribute("style", numberPinCss(g.size, sel));
    }
  }, [selectedGroupKey]);

  // 포커스 — 선택 마커 이미지/줌만 갱신 (범위 재설정·재생성 없음 → 흔들림 방지)
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    const entries = markerObjsRef.current;
    const shown = shownFocusRef.current;
    if (shown === focusId) return;

    const prev = entries.find((e) => e.data.id === shown);
    if (prev) {
      prev.marker.setImage(
        markerImageFor(
          maps,
          imageCacheRef.current,
          prev.data.categoryLarge,
          false,
        ),
      );
      prev.marker.setZIndex(1);
    }

    const next = entries.find((e) => e.data.id === focusId);
    if (next) {
      next.marker.setImage(
        markerImageFor(
          maps,
          imageCacheRef.current,
          next.data.categoryLarge,
          true,
        ),
      );
      next.marker.setZIndex(10);
    }

    // 개별 마커가 없으면(겹친 그룹 멤버) 그 그룹 배지를 하이라이트한다.
    const nextGroup =
      !next && focusId
        ? groupOverlaysRef.current.find((g) => g.memberIds.includes(focusId))
        : undefined;
    const nextGroupKey = nextGroup?.key;
    if (focusedGroupKeyRef.current !== nextGroupKey) {
      focusedGroupKeyRef.current = nextGroupKey;
      for (const g of groupOverlaysRef.current) {
        const sel =
          g.key === selectedGroupKeyRef.current || g.key === nextGroupKey;
        g.el.setAttribute("style", numberPinCss(g.size, sel));
      }
    }

    // 재센터링 — 개별 마커 또는 그룹 위치 기준.
    const center = next
      ? { lat: next.data.lat, lng: next.data.lng }
      : nextGroup
        ? { lat: nextGroup.lat, lng: nextGroup.lng }
        : null;
    if (center && focusCenter) {
      const projection = map.getProjection();
      const markerPoint = projection.containerPointFromCoords(
        new maps.LatLng(center.lat, center.lng),
      );
      const centered = projection.coordsFromContainerPoint(
        new maps.Point(markerPoint.x - focusOffsetX, markerPoint.y),
      );
      map.setCenter(centered);
    }

    // 개별 마커·그룹을 찾았을 때(또는 포커스 해제 시) 기록 → 늦게 생겨도 재포커스 가능.
    if (next || nextGroup || focusId === undefined) {
      shownFocusRef.current = focusId;
    }
  }, [
    focusId,
    focusOffsetX,
    focusCenter,
    markers,
    mapReady,
    mapRef,
    markerObjsRef,
  ]);
}
