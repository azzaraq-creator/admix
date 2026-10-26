"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import {
  type KakaoCustomOverlay,
  type KakaoMap,
  type KakaoMarkerImage,
  type KakaoMaps,
} from "@/lib/kakaoMap";

import {
  BUBBLE_MAX_LEVEL,
  type MapCluster,
  type MapMarker,
  type MarkerEntry,
  type MoveTarget,
} from "./mapTypes";

/**
 * 매체명 말풍선 — 핀·숫자핀과 같은 반투명(70%) 보라 바탕에 또렷한 흰 글자, 테두리 없이 아래 뾰족한 꼬리.
 * 선택(포커스)되면 핀 포커스와 같은 진한 보라를 불투명하게. 이름이 길면 말줄임(전체 이름은 title).
 * 바깥 상자(아래 여백 = 꼬리 길이)의 아래 가운데가 매체 위치다(yAnchor 1).
 */
function bubbleCss(selected: boolean) {
  const bg = selected ? "#5b21c4" : "rgba(122,63,224,0.7)";
  return {
    wrap: "position:relative;padding-bottom:6px;cursor:pointer;",
    // 그림자는 상자 밖에만 생기는 box-shadow — drop-shadow 는 반투명 바탕 안으로 비쳐 탁해진다.
    box: `position:relative;display:block;max-width:190px;padding:4px 10px;border-radius:14px;background:${bg};backdrop-filter:blur(2px);box-shadow:0 1px 3px rgba(26,16,37,${selected ? 0.32 : 0.22});color:#ffffff;font-size:12px;line-height:16px;font-weight:700;letter-spacing:-0.2px;text-shadow:0 0 1px rgba(26,16,37,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
    // 꼬리는 몸통 바로 아래 삼각형 — 몸통과 겹치지 않아 반투명 바탕이 겹쳐 진해지지 않는다.
    tail: `position:absolute;left:50%;bottom:0;width:10px;height:6px;transform:translateX(-50%);background:${bg};clip-path:polygon(0 0,100% 0,50% 100%);`,
  };
}

function createBubble(m: MapMarker) {
  const el = document.createElement("div");
  const box = document.createElement("div");
  const tail = document.createElement("div");
  box.textContent = m.name;
  box.title = m.name;
  el.append(box, tail);
  styleBubble(el, false);
  return el;
}

function styleBubble(el: HTMLDivElement, selected: boolean) {
  const [box, tail] = Array.from(el.children) as HTMLDivElement[];
  const css = bubbleCss(selected);
  el.style.cssText = css.wrap;
  box.style.cssText = css.box;
  tail.style.cssText = css.tail;
}

// 단일 매체 핀 — 반투명(70%) 보라 원 + 흰 카테고리 아이콘(public/markers/pin). 숫자핀(클러스터)과 같은 보라 원이라
// 지도 위 표시가 한 가족으로 보이고, 물방울보다 작아 지도 글씨를 덜 가린다. 기준점은 원 가운데.
const MARKER_SIZE = { width: 32, height: 32 };
const MARKER_ANCHOR = { x: 16, y: 16 };

const MARKER_SRC: Record<string, string> = {
  "전광판&빌보드": "/markers/pin/billboard.svg",
  지하철: "/markers/pin/subway.svg",
  공항: "/markers/pin/airport.svg",
  "기차&기차역": "/markers/pin/train.svg",
  기차역: "/markers/pin/train-station.svg",
  정류장: "/markers/pin/bus-stop.svg",
  "주거&사무공간": "/markers/pin/residential-office.svg",
  "쇼핑몰&마트": "/markers/pin/mart.svg",
  엔터테인먼트: "/markers/pin/entertainment.svg",
  "생활&편의시설": "/markers/pin/amenities.svg",
  기타: "/markers/pin/etc.svg",
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

/**
 * 소분류로 아이콘이 갈리는 경우. 대분류 "공항/기차"는 공항·기차역을 함께 묶고 있어
 * 대분류만 보면 기차역도 공항 핀으로 뜬다. 소분류가 여기 있으면 소분류를 먼저 쓴다.
 */
const SMALL_CATEGORY_TO_ITEM: Record<string, string> = {
  공항: "공항",
  기차역: "기차역",
};

type MarkerCategory = Pick<MapMarker, "categoryLarge" | "categorySmall">;

function markerSrc(category: MarkerCategory, focused = false): string {
  const { categoryLarge, categorySmall } = category;
  const item =
    (categorySmall && SMALL_CATEGORY_TO_ITEM[categorySmall]) ||
    (categoryLarge && CATEGORY_TO_ITEM[categoryLarge]) ||
    "기타";
  const file = MARKER_SRC[item] ?? MARKER_SRC["기타"];
  // 포커스 변형: 보라 원 + 흰 아이콘 (public/markers/pin/focus/*.svg). 크기는 기본과 같다.
  const path = focused
    ? file.replace("/markers/pin/", "/markers/pin/focus/")
    : file;
  return encodeURI(path);
}

function markerImageFor(
  maps: KakaoMaps,
  cache: Record<string, KakaoMarkerImage>,
  category: MarkerCategory,
  focused: boolean,
): KakaoMarkerImage {
  const src = markerSrc(category, focused);
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

// 숫자핀(클러스터·겹침 그룹) 공통 디자인 — 테두리 없는 반투명(70%) 보라 원 + 흰 숫자, 옅은 그림자 하나.
// 선택(팝업 열림·포커스)은 단일 핀 포커스와 같이 한 단계 진한 보라.
function numberPinCss(size: number, selected: boolean): string {
  return `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;font-size:${Math.round(size * 0.4)}px;font-weight:700;letter-spacing:-0.5px;cursor:pointer;color:#ffffff;background:${selected ? "#5b21c4" : "rgba(122,63,224,0.7)"};backdrop-filter:blur(2px);box-shadow:0 1px 3px rgba(26,16,37,${selected ? 0.32 : 0.22});`;
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
  markerObjsRef: RefObject<MarkerEntry[]>;
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
  // 가까이(BUBBLE_MAX_LEVEL 이하) 확대했는지 — 넘나들 때만 핀을 다시 그린다.
  const [bubbleMode, setBubbleMode] = useState(false);
  // 지도 범위 맞춤은 매체 목록이 바뀌었을 때만 — 말풍선 전환으로 다시 그릴 때는 지도를 건드리지 않는다.
  const fittedMarkersRef = useRef<MapMarker[] | null>(null);
  // 마지막으로 가운데 맞춘 포커스 — 말풍선 전환으로 다시 그릴 때 같은 매체로 지도를 또 옮기지 않게.
  const centeredFocusRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;
    const sync = () => setBubbleMode(map.getLevel() <= BUBBLE_MAX_LEVEL);
    sync();
    maps.event.addListener(map, "zoom_changed", sync);
    return () => maps.event.removeListener(map, "zoom_changed", sync);
  }, [mapReady, mapRef]);

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

    markerObjsRef.current.forEach(({ marker, bubble }) => {
      marker?.setMap(null);
      bubble?.overlay.setMap(null);
    });
    markerObjsRef.current = [];
    groupOverlaysRef.current.forEach((o) => o.overlay.setMap(null));
    groupOverlaysRef.current = [];
    shownFocusRef.current = undefined;
    focusedGroupKeyRef.current = undefined;
    // 말풍선 전환으로만 다시 그린 경우(목록은 그대로)엔 범위 맞춤·포커스 재센터링을 하지 않는다.
    const markersChanged = fittedMarkersRef.current !== markers;
    fittedMarkersRef.current = markers;
    if (markersChanged) centeredFocusRef.current = undefined;

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
      if (members.length === 1 && bubbleMode) {
        // 가까이 확대 — 마커 대신 매체명 말풍선.
        const m = first;
        const el = createBubble(m);
        el.addEventListener("click", () => onMarkerClickRef.current?.(m.id));
        const overlay = new maps.CustomOverlay({
          position: pos,
          content: el,
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 2,
          clickable: true,
        });
        overlay.setMap(map);
        markerObjsRef.current.push({
          data: m,
          marker: null,
          bubble: { overlay, el },
        });
      } else if (members.length === 1) {
        const m = first;
        const marker = new maps.Marker({
          position: pos,
          image: markerImageFor(maps, imageCacheRef.current, m, false),
          title: m.name,
          zIndex: 1,
        });
        marker.setMap(map);
        maps.event.addListener(marker, "click", () =>
          onMarkerClickRef.current?.(m.id),
        );
        markerObjsRef.current.push({ data: m, marker, bubble: null });
      } else {
        // 겹친 마커 → 카운트 배지. 클릭 시 그 매체들을 리스트 팝업으로.
        const size =
          members.length >= 100 ? 38 : members.length >= 10 ? 34 : 30;
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

    if (!autoFit || !markersChanged) return;
    if (valid.length === 1) {
      map.setCenter(new maps.LatLng(valid[0].lat, valid[0].lng));
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
    }
  }, [markers, mapReady, autoFit, mapRef, markerObjsRef, bubbleMode]);

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
      const size = c.count >= 100 ? 46 : c.count >= 10 ? 38 : 32;
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

    // 단일 핀 강조 — 마커는 흰 링 이미지, 말풍선은 보라 바탕으로 바꾸고 맨 위로 올린다.
    const setFocused = (entry: MarkerEntry, focused: boolean) => {
      if (entry.marker) {
        entry.marker.setImage(
          markerImageFor(maps, imageCacheRef.current, entry.data, focused),
        );
        entry.marker.setZIndex(focused ? 10 : 1);
      }
      if (entry.bubble) {
        styleBubble(entry.bubble.el, focused);
        entry.bubble.overlay.setZIndex(focused ? 10 : 2);
      }
    };

    const prev = entries.find((e) => e.data.id === shown);
    if (prev) setFocused(prev, false);

    const next = entries.find((e) => e.data.id === focusId);
    if (next) setFocused(next, true);

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

    // 포커스가 풀리면 다음에 같은 매체를 다시 골라도 가운데로 옮긴다.
    if (focusId === undefined) centeredFocusRef.current = undefined;

    // 재센터링 — 개별 마커 또는 그룹 위치 기준.
    const center = next
      ? { lat: next.data.lat, lng: next.data.lng }
      : nextGroup
        ? { lat: nextGroup.lat, lng: nextGroup.lng }
        : null;
    if (center && focusCenter && centeredFocusRef.current !== focusId) {
      centeredFocusRef.current = focusId;
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
    bubbleMode,
    mapReady,
    mapRef,
    markerObjsRef,
  ]);
}
