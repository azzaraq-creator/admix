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
 * 카테고리(대)별 지도 색 — 색 핀(CATEGORY_PIN) 원과 같은 색. [반투명(70%) 바탕 RGB, 선택(포커스) 진한 색].
 * 말풍선·숫자핀(클러스터·겹침 묶음)도 이 색을 쓴다. 여기 없는 카테고리·섞인 묶음은 기본 보라.
 */
const CATEGORY_COLOR: Record<string, [string, string]> = {
  전광판: ["247,103,7", "#D9480F"], // 주황
  빌보드: ["230,73,128", "#C2255C"], // 분홍
  지하철: ["47,158,68", "#2B8A3E"], // 초록
  쉘터: ["28,126,214", "#1864AB"], // 파랑
  "버스/택시": ["245,159,0", "#E67700"], // 노랑
  콜라보: ["156,91,46", "#7A3E14"], // 커피색 — 제휴 매장
};
const DEFAULT_COLOR: [string, string] = ["122,63,224", "#5b21c4"]; // 보라

/**
 * 목록 카드에 마우스를 올린 매체 — 선택(진한 색)보다 한 단계 더: 흰 테두리 + 크게(11-23 사용자 "진해지는 것도 좋은데 눈에 잘 안 띄어").
 * 지도 바탕(밝은 · 어두운 모두)에서 흰 테두리가 갈라 보이게 하고, 그림자도 조금 진하게.
 */
const HOVER_RING = "0 0 0 2px #ffffff,0 2px 8px rgba(26,16,37,0.4)";

/**
 * 카테고리 지도 핀 색(꽉 찬 색) — 매체 찾기 카테고리 탭 이름 앞 작은 동그라미(2026-11-19 사용자: "탭에서 카테고리 앞에 동그라미로 색깔을 알려줘").
 * 색 핀이 없는 카테고리는 기본 보라 핀이라 보라.
 */
export function categoryPinColor(categoryLarge: string): string {
  const [rgb] = CATEGORY_COLOR[categoryLarge] ?? DEFAULT_COLOR;
  return `rgb(${rgb})`;
}

function pinBackground(
  categoryLarge: string | null | undefined,
  selected: boolean,
): string {
  const [rgb, strong] =
    (categoryLarge && CATEGORY_COLOR[categoryLarge]) || DEFAULT_COLOR;
  return selected ? strong : `rgba(${rgb},0.7)`;
}

/** 겹침 묶음 매체가 모두 같은 카테고리면 그 카테고리(색을 맞춘다), 섞이면 null. */
function sharedCategory(members: MapMarker[]): string | null {
  const first = members[0]?.categoryLarge ?? null;
  return members.every((m) => (m.categoryLarge ?? null) === first)
    ? first
    : null;
}

/**
 * 매체명 말풍선 — 핀·숫자핀과 같은 반투명(70%) 카테고리 색 바탕에 또렷한 흰 글자, 테두리 없이 아래 뾰족한 꼬리.
 * 선택(포커스)되면 핀 포커스와 같은 진한 색을 불투명하게. 이름이 길면 말줄임(전체 이름은 title).
 * 바깥 상자(아래 여백 = 꼬리 길이)의 아래 가운데가 매체 위치다(yAnchor 1).
 * 콜라보 내 매장 위치 지도도 우리 매장 이름표를 홈의 선택 말풍선과 같게 그리려고 내보낸다.
 */
export function bubbleCss(
  selected: boolean,
  categoryLarge?: string | null,
  hovered = false,
) {
  const bg = pinBackground(categoryLarge, selected || hovered);
  const shadow = hovered
    ? HOVER_RING
    : `0 1px 3px rgba(26,16,37,${selected ? 0.32 : 0.22})`;
  return {
    // 마우스를 올린 매체는 꼬리 끝(매체 위치)을 기준으로 키운다.
    wrap: `position:relative;padding-bottom:6px;cursor:pointer;${hovered ? "transform:scale(1.15);transform-origin:50% 100%;" : ""}`,
    // 그림자는 상자 밖에만 생기는 box-shadow — drop-shadow 는 반투명 바탕 안으로 비쳐 탁해진다.
    box: `position:relative;display:block;max-width:190px;padding:4px 10px;border-radius:14px;background:${bg};backdrop-filter:blur(2px);box-shadow:${shadow};color:#ffffff;font-size:12px;line-height:16px;font-weight:700;letter-spacing:-0.2px;text-shadow:0 0 1px rgba(26,16,37,0.35);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
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
  styleBubble(el, false, m.categoryLarge);
  return el;
}

function styleBubble(
  el: HTMLDivElement,
  selected: boolean,
  categoryLarge?: string | null,
  hovered = false,
) {
  const [box, tail] = Array.from(el.children) as HTMLDivElement[];
  const css = bubbleCss(selected, categoryLarge, hovered);
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
  전광판: "전광판&빌보드",
  빌보드: "전광판&빌보드",
  지하철: "지하철",
  "공항/기차": "공항",
  "쇼핑몰/마트": "쇼핑몰&마트",
  정류장: "정류장",
  버스: "정류장",
  쉘터: "정류장",
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

/**
 * 카테고리(대)별 색 핀 — 지도에서 카테고리를 색으로 나눠 보게 한다(public/markers/pin/category, 포커스는 focus/).
 * 기본 아이콘 핀의 보라 원만 카테고리 색으로 바꾼 파일이다. 여기 없는 카테고리는 원래 보라 핀.
 */
const CATEGORY_PIN: Record<string, string> = {
  전광판: "display", // 주황
  빌보드: "billboard", // 분홍
  지하철: "subway", // 초록
  쉘터: "shelter", // 파랑
  "버스/택시": "bus-taxi", // 노랑
  콜라보: "cafe", // 커피색 + 커피잔
};

type MarkerCategory = Pick<MapMarker, "categoryLarge" | "categorySmall">;

/** 단일 매체 핀 그림 주소 — 콜라보 내 매장 위치 지도도 홈과 같은 핀을 쓰려고 내보낸다. */
export function markerSrc(category: MarkerCategory, focused = false): string {
  const { categoryLarge, categorySmall } = category;
  const colored = categoryLarge && CATEGORY_PIN[categoryLarge];
  if (colored)
    return `/markers/pin/category/${focused ? "focus/" : ""}${colored}.svg`;
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

// 숫자핀(클러스터·겹침 그룹) 공통 디자인 — 테두리 없는 반투명(70%) 원 + 흰 숫자, 옅은 그림자 하나.
// 색은 묶인 매체 카테고리 핀 색(섞이면 보라). 선택(팝업 열림·포커스)은 단일 핀 포커스와 같이 한 단계 진하게.
// 목록에서 마우스를 올린 매체가 들어 있으면 진하게 + 흰 테두리 + 크게(가운데 기준).
function numberPinCss(
  size: number,
  selected: boolean,
  categoryLarge?: string | null,
  hovered = false,
): string {
  const look = hovered
    ? `box-shadow:${HOVER_RING};transform:scale(1.2);`
    : `box-shadow:0 1px 3px rgba(26,16,37,${selected ? 0.32 : 0.22});`;
  return `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;font-size:${Math.round(size * 0.4)}px;font-weight:700;letter-spacing:-0.5px;cursor:pointer;color:#ffffff;background:${pinBackground(categoryLarge, selected || hovered)};backdrop-filter:blur(2px);${look}`;
}

// 마우스를 올린 매체 핀 — 포커스 핀 그림을 한 단계 크게(그림 40px · 원 지름 32px, 보통 핀은 32px · 원 약 22px) + 원 둘레 흰 테두리.
// 기준점은 원 가운데. 카카오 마커는 테두리를 못 그려서, 마우스를 올린 동안 마커를 숨기고 이 핀을 겹침 표시(CustomOverlay)로 띄운다.
const HOVER_PIN_SIZE = 40;

function createHoverPin(category: MarkerCategory): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = `position:relative;width:${HOVER_PIN_SIZE}px;height:${HOVER_PIN_SIZE}px;pointer-events:none;`;
  // 핀 그림(viewBox 40) 안 원은 반지름 16 — 가장자리 4px 안쪽이 원이다.
  const ring = document.createElement("div");
  ring.style.cssText = `position:absolute;inset:4px;border-radius:9999px;box-shadow:${HOVER_RING};`;
  const img = document.createElement("img");
  img.src = markerSrc(category, true);
  img.alt = "";
  // 크기는 글자로 못 박는다 — 전역 img max-width:100% 가 폭 0인 지도 겹침 상자에 걸려 0×0으로 그려졌다.
  img.style.cssText = `position:absolute;inset:0;display:block;width:${HOVER_PIN_SIZE}px;height:${HOVER_PIN_SIZE}px;max-width:none;`;
  el.append(ring, img);
  return el;
}

/** 겹침 숫자핀 하나 — 같은 자리(≈11m) 매체 묶음. */
type GroupOverlay = {
  overlay: KakaoCustomOverlay;
  el: HTMLDivElement;
  key: string;
  size: number;
  category: string | null;
  memberIds: string[];
  lat: number;
  lng: number;
};

/**
 * 단일 핀 강조 — 포커스이거나 목록에서 마우스를 올린 매체면 마커는 진한 이미지, 말풍선은 진한 카테고리 색 바탕으로 바꾸고
 * 맨 위로 올린다(마우스를 올린 매체가 포커스보다 위).
 */
function paintEntry(
  maps: KakaoMaps,
  cache: Record<string, KakaoMarkerImage>,
  entry: MarkerEntry,
  focusedId: string | undefined,
  hoveredId: string | undefined,
) {
  const hovered = entry.data.id === hoveredId;
  const on = hovered || entry.data.id === focusedId;
  if (entry.marker) {
    entry.marker.setImage(markerImageFor(maps, cache, entry.data, on));
    entry.marker.setZIndex(on ? 10 : 1);
    // 마우스를 올린 동안은 크게 · 테두리 두른 핀(createHoverPin)이 대신한다.
    entry.marker.setVisible(!hovered);
  }
  if (entry.bubble) {
    styleBubble(entry.bubble.el, on, entry.data.categoryLarge, hovered);
    entry.bubble.overlay.setZIndex(hovered ? 11 : on ? 10 : 2);
  }
}

/** 겹침 숫자핀 — 팝업이 열렸거나(selectedGroup) 포커스 · 마우스를 올린 매체가 들어 있으면 진하게(재생성 없이 모양만). */
function paintGroups(
  groups: GroupOverlay[],
  keys: {
    selected?: string;
    focused?: string;
    hovered?: string;
  },
) {
  for (const g of groups) {
    const hovered = g.key === keys.hovered;
    const sel = hovered || g.key === keys.selected || g.key === keys.focused;
    g.el.setAttribute(
      "style",
      numberPinCss(g.size, sel, g.category, hovered),
    );
    g.overlay.setZIndex(hovered ? 9 : sel ? 8 : 6);
  }
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
  hover,
  onMarkerClick,
  onClusterClick,
  onGroupClick,
  namePins = false,
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
  /**
   * 목록 카드에 마우스를 올린 매체(11-23 사용자) — 그 핀 · 말풍선 · 겹침 숫자핀을 선택했을 때처럼 진하게 한다.
   * 지도에선 묶음(클러스터) 안에 들어가 따로 안 보이면 그 자리에 진한 핀(가까이 확대했으면 이름표)을 잠깐 띄운다.
   * 지도는 옮기지 않는다.
   */
  hover?: MapMarker | null;
  onMarkerClick?: (id: string) => void;
  onClusterClick?: (cluster: MapCluster) => void;
  onGroupClick?: (markers: MapMarker[]) => void;
  /**
   * 광고주 매장 찾기(11-11 사용자) — 확대 수준과 상관없이 핀 대신 이름표(말풍선), 같은 자리에 겹쳐도 숫자로 묶지 않는다.
   * (서버 클러스터도 묶지 않게 MediaFindPanel 이 zoom 1 로 묻는다.)
   */
  namePins?: boolean;
}) {
  const clusterOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const groupOverlaysRef = useRef<GroupOverlay[]>([]);
  const imageCacheRef = useRef<Record<string, KakaoMarkerImage>>({});
  const shownFocusRef = useRef<string | undefined>(undefined);
  const focusedGroupKeyRef = useRef<string | undefined>(undefined);
  // 마우스를 올린 매체를 지금 진하게 칠해 둔 곳 — 단일 핀 · 말풍선(id), 겹침 숫자핀(key), 따로 띄운 핀(overlay).
  const hoverIdRef = useRef<string | undefined>(undefined);
  const hoverGroupKeyRef = useRef<string | undefined>(undefined);
  const hoverOverlayRef = useRef<KakaoCustomOverlay | null>(null);
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
    hoverIdRef.current = undefined;
    hoverGroupKeyRef.current = undefined;
    // 말풍선 전환으로만 다시 그린 경우(목록은 그대로)엔 범위 맞춤·포커스 재센터링을 하지 않는다.
    const markersChanged = fittedMarkersRef.current !== markers;
    fittedMarkersRef.current = markers;
    if (markersChanged) centeredFocusRef.current = undefined;

    const valid = markers.filter(
      (m) => typeof m.lat === "number" && typeof m.lng === "number",
    );
    if (valid.length === 0) return;

    // 거의 같은 위치(≈11m)의 마커를 그룹핑 → 최대 확대에서도 겹치는 핀을 하나로. 이름표만(namePins)이면 묶지 않는다.
    const groups = new Map<string, MapMarker[]>();
    valid.forEach((m) => {
      const key = namePins
        ? m.id
        : `${Math.round(m.lat * GROUP_PRECISION)},${Math.round(
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
      if (members.length === 1 && (bubbleMode || namePins)) {
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
        const category = sharedCategory(members);
        const el = document.createElement("div");
        el.style.cssText = numberPinCss(size, selected, category);
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
          category,
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
  }, [markers, mapReady, autoFit, mapRef, markerObjsRef, bubbleMode, namePins]);

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
      el.style.cssText = numberPinCss(size, false, c.categoryLarge);
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

  // 겹침 그룹 배지 선택(팝업 열림 또는 포커스) — 재생성 없이 모양만 토글.
  useEffect(() => {
    paintGroups(groupOverlaysRef.current, {
      selected: selectedGroupKey,
      focused: focusedGroupKeyRef.current,
      hovered: hoverGroupKeyRef.current,
    });
  }, [selectedGroupKey]);

  // 포커스 — 선택 마커 이미지/줌만 갱신 (범위 재설정·재생성 없음 → 흔들림 방지)
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    const entries = markerObjsRef.current;
    const shown = shownFocusRef.current;
    if (shown === focusId) return;

    // 지난 포커스는 풀고(마우스를 올려 둔 매체면 진한 채로 둔다) 새 포커스를 진하게.
    const cache = imageCacheRef.current;
    const prev = entries.find((e) => e.data.id === shown);
    if (prev) paintEntry(maps, cache, prev, focusId, hoverIdRef.current);

    const next = entries.find((e) => e.data.id === focusId);
    if (next) paintEntry(maps, cache, next, focusId, hoverIdRef.current);

    // 개별 마커가 없으면(겹친 그룹 멤버) 그 그룹 배지를 하이라이트한다.
    const nextGroup =
      !next && focusId
        ? groupOverlaysRef.current.find((g) => g.memberIds.includes(focusId))
        : undefined;
    const nextGroupKey = nextGroup?.key;
    if (focusedGroupKeyRef.current !== nextGroupKey) {
      focusedGroupKeyRef.current = nextGroupKey;
      paintGroups(groupOverlaysRef.current, {
        selected: selectedGroupKeyRef.current,
        focused: nextGroupKey,
        hovered: hoverGroupKeyRef.current,
      });
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

  // 목록 카드에 마우스를 올린 매체 강조 — 말풍선 · 겹침 숫자핀은 그 자리에서 진하게 · 테두리 · 크게,
  // 핀(카카오 마커는 테두리를 못 그린다)과 묶음(클러스터)에 들어가 안 보이는 매체는 크게 · 테두리 두른 핀(가까이면 이름표)을 따로 띄운다.
  // 핀을 다시 그리면(목록 · 말풍선 전환) 강조도 다시 칠한다 — 다시 그릴 때 hoverIdRef 를 비운다.
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;
    const entries = markerObjsRef.current;
    const id = hover?.id;

    const prevId = hoverIdRef.current;
    hoverIdRef.current = id;
    const prev =
      prevId && prevId !== id
        ? entries.find((e) => e.data.id === prevId)
        : undefined;
    const cache = imageCacheRef.current;
    if (prev) paintEntry(maps, cache, prev, shownFocusRef.current, id);
    hoverOverlayRef.current?.setMap(null);
    hoverOverlayRef.current = null;

    const entry = id ? entries.find((e) => e.data.id === id) : undefined;
    if (entry) paintEntry(maps, cache, entry, shownFocusRef.current, id);

    const group =
      !entry && id
        ? groupOverlaysRef.current.find((g) => g.memberIds.includes(id))
        : undefined;
    if (hoverGroupKeyRef.current !== group?.key) {
      hoverGroupKeyRef.current = group?.key;
      paintGroups(groupOverlaysRef.current, {
        selected: selectedGroupKeyRef.current,
        focused: focusedGroupKeyRef.current,
        hovered: group?.key,
      });
    }

    if (
      entry?.bubble ||
      group ||
      !hover ||
      !Number.isFinite(hover.lat) ||
      !Number.isFinite(hover.lng)
    )
      return;
    // 핀(숨긴 마커 자리) · 묶음 안의 매체 — 지금 확대 수준의 단일 매체 모양(가까이면 이름표, 멀면 핀)으로 띄운다. 누르지는 않는다.
    const asBubble = !entry && (bubbleMode || namePins);
    let content: HTMLElement;
    if (asBubble) {
      const bubble = createBubble(hover);
      styleBubble(bubble, true, hover.categoryLarge, true);
      bubble.style.pointerEvents = "none";
      content = bubble;
    } else {
      content = createHoverPin(hover);
    }
    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(hover.lat, hover.lng),
      content,
      xAnchor: 0.5,
      yAnchor: asBubble ? 1 : 0.5,
      zIndex: 12,
    });
    overlay.setMap(map);
    hoverOverlayRef.current = overlay;
  }, [hover, markers, bubbleMode, namePins, mapReady, mapRef, markerObjsRef]);

  // 화면을 떠나면 따로 띄운 핀도 지운다.
  useEffect(() => () => hoverOverlayRef.current?.setMap(null), []);
}
