"use client";

import { useEffect, useRef } from "react";

import { loadKakaoSdk } from "@/lib/kakaoMap";

type KakaoNamespace = {
  maps: {
    load: (callback: () => void) => void;
    LatLng: new (lat: number, lng: number) => object;
    StaticMap: new (
      container: HTMLElement,
      options: { center: object; level: number; marker?: { position: object } },
    ) => void;
  };
};

export function StaticKakaoMap({
  latitude,
  longitude,
  level = 4,
  className,
}: {
  latitude: number;
  longitude: number;
  level?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        const kakao = (window as unknown as { kakao?: KakaoNamespace }).kakao;
        const container = ref.current;
        if (cancelled || !kakao || !container) return;
        kakao.maps.load(() => {
          if (cancelled || !container) return;
          container.innerHTML = "";
          const center = new kakao.maps.LatLng(latitude, longitude);
          new kakao.maps.StaticMap(container, {
            center,
            level,
            marker: { position: center },
          });
        });
      })
      .catch((error) => {
        console.error("[StaticKakaoMap] init failed:", error);
      });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, level]);

  return <div ref={ref} className={className} />;
}
