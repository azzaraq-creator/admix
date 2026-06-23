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
}

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
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
  setBounds: (bounds: KakaoLatLngBounds) => void;
  getProjection: () => KakaoProjection;
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
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
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
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_APP_KEY}&autoload=false`;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () =>
      reject(new Error("Kakao Maps SDK load failed")),
    );
    document.head.appendChild(script);
  });
}

export function MapArea({
  className,
  markers = [],
  onMarkerClick,
  focusId,
  focusOffsetX = 0,
  focusCenter = true,
  popupId,
  popupContent,
  onPopupClose,
}: {
  className?: string;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
  focusId?: string;
  focusOffsetX?: number;
  focusCenter?: boolean;
  popupId?: string | null;
  popupContent?: ReactNode;
  onPopupClose?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerObjsRef = useRef<{ marker: KakaoMarker; data: MapMarker }[]>([]);
  const imageCacheRef = useRef<Record<string, KakaoMarkerImage>>({});
  const shownFocusRef = useRef<string | undefined>(undefined);
  const overlayRef = useRef<KakaoCustomOverlay | null>(null);
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
  const [mapReady, setMapReady] = useState(false);
  const [flipUp, setFlipUp] = useState(false);

  useEffect(() => {
    onPopupCloseRef.current = onPopupClose;
    onMarkerClickRef.current = onMarkerClick;
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
          mapRef.current = new maps.Map(container, {
            center: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
            level: 5,
          });
          setMapReady(true);
        });
      })
      .catch((error) => {
        console.error("[MapArea] Kakao map init failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 마커 생성 + 범위 맞춤 — markers 변경 시에만 (포커스 변경으로는 재실행 안 됨)
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    markerObjsRef.current.forEach(({ marker }) => marker.setMap(null));
    markerObjsRef.current = [];
    shownFocusRef.current = undefined;

    const valid = markers.filter(
      (m) => typeof m.lat === "number" && typeof m.lng === "number",
    );
    if (valid.length === 0) return;

    const bounds = new maps.LatLngBounds();
    valid.forEach((m) => {
      const pos = new maps.LatLng(m.lat, m.lng);
      const marker = new maps.Marker({
        position: pos,
        image: markerImageFor(maps, imageCacheRef.current, m.categoryLarge, false),
        title: m.name,
        zIndex: 1,
      });
      marker.setMap(map);
      maps.event.addListener(marker, "click", () =>
        onMarkerClickRef.current?.(m.id),
      );
      markerObjsRef.current.push({ marker, data: m });
      bounds.extend(pos);
    });

    if (valid.length === 1) {
      map.setCenter(new maps.LatLng(valid[0].lat, valid[0].lng));
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
    }
  }, [markers, mapReady]);

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

    shownFocusRef.current = focusId;
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

  useEffect(() => {
    const maps = window.kakao?.maps;
    const overlay = overlayRef.current;
    const map = mapRef.current;
    if (!maps || !overlay || !map) return;
    const target = popupId ? markers.find((m) => m.id === popupId) : undefined;
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
    }
  }, [popupId, markers, mapReady]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full bg-[#e9edf0]" />
      {popupId && popupEl
        ? createPortal(
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2",
                flipUp ? "bottom-[24px]" : "top-[24px]",
              )}
            >
              {popupContent}
            </div>,
            popupEl,
          )
        : null}
    </div>
  );
}
