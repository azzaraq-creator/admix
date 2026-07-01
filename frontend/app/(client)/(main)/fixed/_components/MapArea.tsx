"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export interface MapMarker {
  id: string; // media_id (Drawer 연동용)
  lat: number;
  lng: number;
  name: string;
  categoryLarge?: string | null;
  minAdvertisementFeeKrw?: number | null;
  thumbnailUrl?: string | null;
  badge?: "popular" | "new" | null;
}

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
}

interface KakaoMarkerImage {
  __brand?: "markerImage";
}

interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
  setImage: (image: KakaoMarkerImage) => void;
  setZIndex: (zIndex: number) => void;
}

interface KakaoCustomOverlay {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
}

interface KakaoPoint {
  x: number;
  y: number;
}

interface KakaoProjection {
  containerPointFromCoords: (latlng: KakaoLatLng) => KakaoPoint;
  coordsFromContainerPoint: (point: object) => KakaoLatLng;
}

interface KakaoMap {
  relayout: () => void;
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  getLevel: () => number;
  setBounds: (bounds: KakaoLatLngBounds) => void;
  getBounds: () => KakaoLatLngBounds;
  getProjection: () => KakaoProjection;
}

interface KakaoGeocoderResult {
  x: string;
  y: string;
}

interface KakaoPlacesResult {
  x: string;
  y: string;
}

interface KakaoServices {
  Geocoder: new () => {
    addressSearch: (
      query: string,
      callback: (result: KakaoGeocoderResult[], status: string) => void,
    ) => void;
  };
  Places: new () => {
    keywordSearch: (
      query: string,
      callback: (result: KakaoPlacesResult[], status: string) => void,
    ) => void;
  };
  Status: { OK: string };
}

interface KakaoMaps {
  load: (callback: () => void) => void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Marker: new (options: {
    position: KakaoLatLng;
    image?: KakaoMarkerImage;
    title?: string;
    zIndex?: number;
  }) => KakaoMarker;
  MarkerImage: new (
    src: string,
    size: object,
    options?: object,
  ) => KakaoMarkerImage;
  Size: new (width: number, height: number) => object;
  Point: new (x: number, y: number) => object;
  CustomOverlay: new (options: {
    position: KakaoLatLng;
    content: HTMLElement;
    xAnchor?: number;
    yAnchor?: number;
    zIndex?: number;
    clickable?: boolean;
  }) => KakaoCustomOverlay;
  event: {
    addListener: (target: object, type: string, handler: () => void) => void;
    removeListener: (
      target: object,
      type: string,
      handler: () => void,
    ) => void;
  };
  services?: KakaoServices;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

export type MapMoveType = "program" | "zoom" | "drag";

export interface MapBoundsPayload {
  neLat: number;
  swLat: number;
  neLng: number;
  swLng: number;
  zoom: number;
  moveType: MapMoveType;
}

export interface MapCluster {
  lat: number;
  lng: number;
  count: number;
}

export interface MoveTarget {
  lat: number;
  lng: number;
  level?: number;
}

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const SCRIPT_ID = "kakao-maps-sdk";
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };
const POPUP_FLIP_MARGIN = 360;

const MARKER_SIZE = { width: 40, height: 40 };
const MARKER_ANCHOR = { x: 20, y: 16 };

const MARKER_SRC: Record<string, string> = {
  "전광판&빌보드": "/markers/전광판-빌보드.svg",
  지하철: "/markers/지하철.svg",
  공항: "/markers/공항.svg",
  "기차&기차역": "/markers/기차-기차역.svg",
  기차역: "/markers/기차역.svg",
  정류장: "/markers/정류장.svg",
  "주거&사무공간": "/markers/주거-사무공간.svg",
  "쇼핑몰&마트": "/markers/쇼핑몰-마트.svg",
  엔터테인먼트: "/markers/엔터테인먼트.svg",
  "생활&편의시설": "/markers/생활-편의시설.svg",
  기타: "/markers/기타.svg",
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

const FOCUS_SCALE = 1.4; // 포커스 시 마커 확대 배율

function markerSrc(categoryLarge?: string | null, focused = false): string {
  const item = (categoryLarge && CATEGORY_TO_ITEM[categoryLarge]) || "기타";
  const file = MARKER_SRC[item] ?? MARKER_SRC["기타"];
  // 포커스 변형: 바깥 링 흰색 (public/markers/focus/*.svg)
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
    const scale = focused ? FOCUS_SCALE : 1;
    cache[src] = new maps.MarkerImage(
      src,
      new maps.Size(MARKER_SIZE.width * scale, MARKER_SIZE.height * scale),
      {
        offset: new maps.Point(MARKER_ANCHOR.x * scale, MARKER_ANCHOR.y * scale),
      },
    );
  }
  return cache[src];
}

function loadKakaoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.kakao?.maps) {
      resolve();
      return;
    }
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Kakao Maps SDK load failed")),
      );
      return;
    }
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false&libraries=services`;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Kakao Maps SDK load failed")),
    );
    document.head.appendChild(script);
  });
}

// 주소·장소명 → 좌표. 장소 키워드 검색 우선, 실패 시 주소 검색 fallback.
export async function geocodeAddress(
  query: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;
  await loadKakaoSdk();
  const maps = window.kakao?.maps;
  if (!maps) return null;

  return new Promise((resolve) => {
    maps.load(() => {
      const services = maps.services;
      if (!services) {
        resolve(null);
        return;
      }
      const places = new services.Places();
      places.keywordSearch(trimmed, (placeResult, placeStatus) => {
        if (placeStatus === services.Status.OK && placeResult.length > 0) {
          resolve({
            lat: Number(placeResult[0].y),
            lng: Number(placeResult[0].x),
          });
          return;
        }
        const geocoder = new services.Geocoder();
        geocoder.addressSearch(trimmed, (addrResult, addrStatus) => {
          if (addrStatus === services.Status.OK && addrResult.length > 0) {
            resolve({
              lat: Number(addrResult[0].y),
              lng: Number(addrResult[0].x),
            });
          } else {
            resolve(null);
          }
        });
      });
    });
  });
}

export function MapArea({
  className,
  markers = [],
  clusters = [],
  onMarkerClick,
  onClusterClick,
  onGroupClick,
  focusId,
  focusOffsetX = 0,
  focusCenter = true,
  autoFit = true,
  moveTarget,
  onBoundsChange,
  popupId,
  popupPosition,
  popupContent,
  onPopupClose,
}: {
  className?: string;
  markers?: MapMarker[];
  clusters?: MapCluster[];
  onMarkerClick?: (id: string) => void;
  onClusterClick?: (cluster: MapCluster) => void;
  onGroupClick?: (markers: MapMarker[]) => void;
  focusId?: string;
  focusOffsetX?: number;
  focusCenter?: boolean;
  autoFit?: boolean;
  moveTarget?: MoveTarget | null;
  onBoundsChange?: (bounds: MapBoundsPayload) => void;
  popupId?: string | null;
  popupPosition?: { lat: number; lng: number } | null;
  popupContent?: ReactNode;
  onPopupClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerObjsRef = useRef<{ marker: KakaoMarker; data: MapMarker }[]>([]);
  const clusterOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const groupOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const imageCacheRef = useRef<Record<string, KakaoMarkerImage>>({});
  const shownFocusRef = useRef<string | undefined>(undefined);
  const overlayRef = useRef<KakaoCustomOverlay | null>(null);
  const programmaticMoveRef = useRef(false);
  const zoomedRef = useRef(false);
  const draggedRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTargetRef = useRef(moveTarget);
  const [popupEl] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.position = "relative";
    el.style.width = "0";
    el.style.height = "0";
    return el;
  });
  const onPopupCloseRef = useRef(onPopupClose);
  const onMarkerClickRef = useRef(onMarkerClick);
  const onClusterClickRef = useRef(onClusterClick);
  const onGroupClickRef = useRef(onGroupClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const autoFitRef = useRef(autoFit);
  const [mapReady, setMapReady] = useState(false);
  const [flipUp, setFlipUp] = useState(false);
  const [shiftX, setShiftX] = useState(0);

  useEffect(() => {
    onPopupCloseRef.current = onPopupClose;
    onMarkerClickRef.current = onMarkerClick;
    onClusterClickRef.current = onClusterClick;
    onGroupClickRef.current = onGroupClick;
    onBoundsChangeRef.current = onBoundsChange;
    autoFitRef.current = autoFit;
    moveTargetRef.current = moveTarget;
  });

  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        const container = containerRef.current;
        if (cancelled || !maps || !container) return;
        maps.load(() => {
          if (cancelled || !container) return;
          const map = new maps.Map(container, {
            center: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
            level: 5,
          });
          mapRef.current = map;
          // 초기 위치의 첫 idle은 사용자 이동이 아님(버튼 오노출 방지).
          programmaticMoveRef.current = true;

          // idle/zoom/drag 리스너를 지도 생성과 동시에 부착 → 첫 idle(초기 커밋) 놓침 방지.
          const markZoom = () => {
            zoomedRef.current = true;
          };
          const markDrag = () => {
            draggedRef.current = true;
          };
          const emit = (moveType: MapMoveType) => {
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            let neLat = ne.getLat();
            let swLat = sw.getLat();
            let neLng = ne.getLng();
            let swLng = sw.getLng();
            // 모바일 진입 시 지도가 숨김(크기 0)이면 getBounds가 한 점을 반환한다.
            // degenerate(넓이 0) bbox면 중심 기준 기본 span으로 확장(빈 결과 방지).
            if (Math.abs(neLat - swLat) < 1e-6 || Math.abs(neLng - swLng) < 1e-6) {
              const cLat = (neLat + swLat) / 2;
              const cLng = (neLng + swLng) / 2;
              const D_LAT = 0.03;
              const D_LNG = 0.03;
              neLat = cLat + D_LAT;
              swLat = cLat - D_LAT;
              neLng = cLng + D_LNG;
              swLng = cLng - D_LNG;
            }
            programmaticMoveRef.current = false;
            zoomedRef.current = false;
            draggedRef.current = false;
            onBoundsChangeRef.current?.({
              neLat,
              neLng,
              swLat,
              swLng,
              zoom: map.getLevel(),
              moveType,
            });
          };
          const handleIdle = () => {
            // 프로그램 이동(지오코딩/클러스터/moveTarget)은 setCenter+setLevel이
            // idle을 여러 번 발생시키므로, debounce로 최종 settled 상태만 통지.
            if (programmaticMoveRef.current) {
              if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
              idleTimerRef.current = setTimeout(() => emit("program"), 180);
              return;
            }
            // 사용자 줌/드래그는 즉시 통지. (플래그 없으면 program 취급 → 버튼 오노출 방지)
            emit(
              zoomedRef.current
                ? "zoom"
                : draggedRef.current
                  ? "drag"
                  : "program",
            );
          };
          maps.event.addListener(map, "zoom_changed", markZoom);
          maps.event.addListener(map, "dragend", markDrag);
          maps.event.addListener(map, "idle", handleIdle);
          listenerCleanupRef.current = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            maps.event.removeListener(map, "zoom_changed", markZoom);
            maps.event.removeListener(map, "dragend", markDrag);
            maps.event.removeListener(map, "idle", handleIdle);
          };

          setMapReady(true);
        });
      })
      .catch((error) => {
        console.error("[MapArea] Kakao map init failed:", error);
      });
    return () => {
      cancelled = true;
      listenerCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const fitToMarkers = () => {
      if (!autoFitRef.current) return;
      const maps = window.kakao?.maps;
      const map = mapRef.current;
      if (!maps || !map) return;
      const entries = markerObjsRef.current;
      if (entries.length === 0) return;
      if (entries.length === 1) {
        map.setCenter(
          new maps.LatLng(entries[0].data.lat, entries[0].data.lng),
        );
        map.setLevel(5);
        return;
      }
      const bounds = new maps.LatLngBounds();
      entries.forEach(({ data }) =>
        bounds.extend(new maps.LatLng(data.lat, data.lng)),
      );
      map.setBounds(bounds);
    };

    let prevWidth = container.clientWidth;
    let prevHeight = container.clientHeight;
    const observer = new ResizeObserver((entries) => {
      const map = mapRef.current;
      if (!map) return;
      const { width, height } = entries[0].contentRect;
      const becameVisible =
        width > 0 && height > 0 && (prevWidth === 0 || prevHeight === 0);
      prevWidth = width;
      prevHeight = height;
      if (becameVisible) {
        map.relayout();
        // 모바일: 지도가 숨김(크기 0)으로 생성돼 센터가 어긋나므로, 보이게 될 때 재센터링.
        const maps = window.kakao?.maps;
        const mt = moveTargetRef.current;
        if (maps && mt) {
          programmaticMoveRef.current = true;
          map.setCenter(new maps.LatLng(mt.lat, mt.lng));
          if (mt.level != null) map.setLevel(mt.level);
        }
        fitToMarkers();
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [mapReady]);

  // 마커 생성 + 범위 맞춤 — markers 변경 시에만 (포커스 변경으로는 재실행 안 됨)
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    markerObjsRef.current.forEach(({ marker }) => marker.setMap(null));
    markerObjsRef.current = [];
    groupOverlaysRef.current.forEach((o) => o.setMap(null));
    groupOverlaysRef.current = [];
    shownFocusRef.current = undefined;

    const valid = markers.filter(
      (m) => typeof m.lat === "number" && typeof m.lng === "number",
    );
    if (valid.length === 0) return;

    // 거의 같은 위치(≈11m)의 마커를 그룹핑 → 최대 확대에서도 겹치는 핀을 하나로.
    const GROUP_PRECISION = 1e4; // 소수 4자리 ≈ 11m
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
    groups.forEach((members) => {
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
        const size = members.length >= 100 ? 48 : members.length >= 10 ? 44 : 40;
        const el = document.createElement("div");
        el.style.cssText = `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:#00aaa4;border:2.6px solid #007571;color:#ffffff;font-size:14px;font-weight:700;box-shadow:0 4px 6px rgba(0,0,0,0.25);cursor:pointer;`;
        el.textContent = String(members.length);
        el.addEventListener("click", () => onGroupClickRef.current?.(members));
        const overlay = new maps.CustomOverlay({
          position: pos,
          content: el,
          xAnchor: 0.5,
          yAnchor: 0.5,
          zIndex: 6,
          clickable: true,
        });
        overlay.setMap(map);
        groupOverlaysRef.current.push(overlay);
      }
    });

    if (!autoFit) return;
    if (valid.length === 1) {
      map.setCenter(new maps.LatLng(valid[0].lat, valid[0].lng));
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
    }
  }, [markers, mapReady, autoFit]);

  // 검색어 지오코딩 결과로 지도 이동(프로그램 이동 → 사용자 이동 아님으로 표시).
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map || !moveTarget) return;
    programmaticMoveRef.current = true;
    map.setCenter(new maps.LatLng(moveTarget.lat, moveTarget.lng));
    if (moveTarget.level != null) map.setLevel(moveTarget.level);
  }, [moveTarget, mapReady]);

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
      el.style.cssText = `display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:9999px;background:rgba(0,170,164,0.85);border:2px solid #ffffff;color:#ffffff;font-size:13px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;`;
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
  }, [clusters, mapReady]);

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

    if (next && focusCenter) {
      const projection = map.getProjection();
      const markerPoint = projection.containerPointFromCoords(
        new maps.LatLng(next.data.lat, next.data.lng),
      );
      const center = projection.coordsFromContainerPoint(
        new maps.Point(markerPoint.x - focusOffsetX, markerPoint.y),
      );
      map.setCenter(center);
    }

    // 마커를 찾았을 때만(또는 포커스 해제 시) 기록 → 이동·재조회로 마커가 늦게 생겨도 재포커스 가능.
    if (next || focusId === undefined) {
      shownFocusRef.current = focusId;
    }
  }, [focusId, focusOffsetX, focusCenter, markers, mapReady]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    const el = popupEl;
    if (!mapReady || !maps || !map || !el) return;
    if (!overlayRef.current) {
      overlayRef.current = new maps.CustomOverlay({
        position: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 20,
        clickable: true,
      });
    }
    const handleMapClick = () => onPopupCloseRef.current?.();
    maps.event.addListener(map, "click", handleMapClick);
    return () => {
      maps.event.removeListener(map, "click", handleMapClick);
    };
  }, [mapReady, popupEl]);

  // 팝업 위에서의 스크롤/드래그가 지도(줌·이동)로 전파되지 않도록 네이티브 이벤트 차단.
  // (React onWheel stopPropagation은 카카오 네이티브 리스너를 못 막음)
  useEffect(() => {
    const el = popupEl;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop);
    el.addEventListener("touchmove", stop);
    el.addEventListener("mousedown", stop);
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("mousedown", stop);
    };
  }, [popupEl]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const overlay = overlayRef.current;
    const map = mapRef.current;
    if (!maps || !overlay || !map) return;
    // 명시적 위치(겹침 그룹) 우선, 없으면 popupId 마커 위치.
    const target =
      popupPosition ??
      (popupId ? markers.find((m) => m.id === popupId) : undefined);
    if (!target) {
      overlay.setMap(null);
      return;
    }
    const pos = new maps.LatLng(target.lat, target.lng);
    overlay.setPosition(pos);
    overlay.setMap(map);
    const container = containerRef.current;
    const projection = map.getProjection();
    if (container && projection) {
      const point = projection.containerPointFromCoords(pos);
      setFlipUp(point.y > container.clientHeight - POPUP_FLIP_MARGIN);
      // 수평: 팝업이 지도 좌우를 벗어나지 않도록 시프트 계산.
      const halfW = Math.min(191, Math.max(0, (container.clientWidth - 24) / 2));
      const margin = 12;
      let sx = 0;
      if (point.x - halfW < margin) sx = margin - (point.x - halfW);
      else if (point.x + halfW > container.clientWidth - margin)
        sx = container.clientWidth - margin - (point.x + halfW);
      setShiftX(sx);
    }
  }, [popupId, popupPosition, markers, mapReady]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full bg-[#e9edf0]" />
      {(popupId || popupPosition) && popupEl
        ? createPortal(
            <div
              className={cn(
                "absolute left-1/2",
                flipUp ? "bottom-[30px]" : "top-[30px]",
              )}
              style={{ transform: `translateX(calc(-50% + ${shiftX}px))` }}
            >
              {popupContent}
            </div>,
            popupEl,
          )
        : null}
    </div>
  );
}
