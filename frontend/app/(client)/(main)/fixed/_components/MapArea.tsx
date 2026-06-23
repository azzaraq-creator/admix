"use client";

import { useEffect, useRef, useState } from "react";

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
}

interface KakaoMap {
  relayout: () => void;
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  setBounds: (bounds: KakaoLatLngBounds) => void;
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
  }) => KakaoMarker;
  MarkerImage: new (
    src: string,
    size: object,
    options?: object,
  ) => KakaoMarkerImage;
  Size: new (width: number, height: number) => object;
  Point: new (x: number, y: number) => object;
  event: {
    addListener: (target: object, type: string, handler: () => void) => void;
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

function markerSrc(categoryLarge?: string | null): string {
  const item = (categoryLarge && CATEGORY_TO_ITEM[categoryLarge]) || "기타";
  return encodeURI(MARKER_SRC[item] ?? MARKER_SRC["기타"]);
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
}: {
  className?: string;
  markers?: MapMarker[];
  onMarkerClick?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markerObjsRef = useRef<KakaoMarker[]>([]);
  const [mapReady, setMapReady] = useState(false);

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

  // 마커 렌더 — markers 변경 시 기존 제거 후 재생성 + 범위 맞춤
  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    if (!mapReady || !maps || !map) return;

    markerObjsRef.current.forEach((m) => m.setMap(null));
    markerObjsRef.current = [];

    const valid = markers.filter(
      (m) => typeof m.lat === "number" && typeof m.lng === "number",
    );
    if (valid.length === 0) return;

    const imageCache: Record<string, KakaoMarkerImage> = {};
    const imageFor = (categoryLarge?: string | null): KakaoMarkerImage => {
      const src = markerSrc(categoryLarge);
      if (!imageCache[src]) {
        imageCache[src] = new maps.MarkerImage(
          src,
          new maps.Size(MARKER_SIZE.width, MARKER_SIZE.height),
          { offset: new maps.Point(MARKER_ANCHOR.x, MARKER_ANCHOR.y) },
        );
      }
      return imageCache[src];
    };

    const bounds = new maps.LatLngBounds();
    valid.forEach((m) => {
      const pos = new maps.LatLng(m.lat, m.lng);
      const marker = new maps.Marker({
        position: pos,
        image: imageFor(m.categoryLarge),
        title: m.name,
      });
      marker.setMap(map);
      if (onMarkerClick) {
        maps.event.addListener(marker, "click", () => onMarkerClick(m.id));
      }
      markerObjsRef.current.push(marker);
      bounds.extend(pos);
    });

    if (valid.length === 1) {
      map.setCenter(new maps.LatLng(valid[0].lat, valid[0].lng));
      map.setLevel(5);
    } else {
      map.setBounds(bounds);
    }
  }, [markers, mapReady, onMarkerClick]);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full bg-[#e9edf0]" />
    </div>
  );
}
