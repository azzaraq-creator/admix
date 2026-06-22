"use client";

import { useEffect, useRef } from "react";

interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

interface KakaoMap {
  relayout: () => void;
  setCenter: (latlng: KakaoLatLng) => void;
}

interface KakaoMaps {
  load: (callback: () => void) => void;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number },
  ) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
}

declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const SCRIPT_ID = "kakao-maps-sdk";
const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

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

export function MapArea({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);

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
        });
      })
      .catch((error) => {
        console.error("[MapArea] Kakao map init failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={className}>
      <div ref={containerRef} className="h-full w-full bg-[#e9edf0]" />
    </div>
  );
}
