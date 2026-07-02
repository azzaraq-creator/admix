const KAKAO_APP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ?? "";
const SCRIPT_ID = "kakao-maps-sdk";

export interface KakaoLatLng {
  getLat: () => number;
  getLng: () => number;
}

export interface KakaoLatLngBounds {
  extend: (latlng: KakaoLatLng) => void;
  getSouthWest: () => KakaoLatLng;
  getNorthEast: () => KakaoLatLng;
}

export interface KakaoMarkerImage {
  __brand?: "markerImage";
}

export interface KakaoMarker {
  setMap: (map: KakaoMap | null) => void;
  setImage: (image: KakaoMarkerImage) => void;
  setZIndex: (zIndex: number) => void;
}

export interface KakaoCustomOverlay {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
}

export interface KakaoPoint {
  x: number;
  y: number;
}

export interface KakaoProjection {
  containerPointFromCoords: (latlng: KakaoLatLng) => KakaoPoint;
  coordsFromContainerPoint: (point: object) => KakaoLatLng;
}

export interface KakaoMap {
  relayout: () => void;
  setCenter: (latlng: KakaoLatLng) => void;
  setLevel: (level: number) => void;
  getLevel: () => number;
  setBounds: (bounds: KakaoLatLngBounds) => void;
  getBounds: () => KakaoLatLngBounds;
  getProjection: () => KakaoProjection;
}

export interface KakaoGeocoderResult {
  x: string;
  y: string;
}

export interface KakaoPlacesResult {
  x: string;
  y: string;
}

export interface KakaoServices {
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

export interface KakaoMaps {
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

export function loadKakaoSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Kakao Maps SDK requires a browser environment"));
      return;
    }
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
