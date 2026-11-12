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
  setMap: (map: KakaoMap | KakaoRoadview | null) => void;
  setImage: (image: KakaoMarkerImage) => void;
  setZIndex: (zIndex: number) => void;
}

export interface KakaoCustomOverlay {
  setMap: (map: KakaoMap | null) => void;
  setPosition: (latlng: KakaoLatLng) => void;
  setZIndex: (zIndex: number) => void;
}

export interface KakaoPolygon {
  setMap: (map: KakaoMap | null) => void;
  setPath: (path: KakaoLatLng[]) => void;
  setOptions: (options: {
    strokeWeight?: number;
    strokeOpacity?: number;
    fillOpacity?: number;
    zIndex?: number;
  }) => void;
}

/** 지도 click 등 마우스 이벤트 — 누른 자리 좌표. */
export interface KakaoMouseEvent {
  latLng: KakaoLatLng;
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
  getCenter: () => KakaoLatLng;
  setLevel: (level: number) => void;
  getLevel: () => number;
  /** 여백(px)은 위·오른쪽·아래·왼쪽 순 — 빼면 기본 여백. */
  setBounds: (
    bounds: KakaoLatLngBounds,
    paddingTop?: number,
    paddingRight?: number,
    paddingBottom?: number,
    paddingLeft?: number,
  ) => void;
  getBounds: () => KakaoLatLngBounds;
  getProjection: () => KakaoProjection;
}

/** 로드뷰 — 지도 SDK 기본에 들어 있다(따로 libraries 필요 없음). */
export interface KakaoRoadview {
  setPanoId: (panoId: number, position: KakaoLatLng) => void;
  getPosition: () => KakaoLatLng;
  setViewpoint: (viewpoint: {
    pan: number;
    tilt: number;
    zoom: number;
  }) => void;
  relayout: () => void;
}

export interface KakaoRoadviewClient {
  getNearestPanoId: (
    position: KakaoLatLng,
    radius: number,
    callback: (panoId: number | null) => void,
  ) => void;
}

export interface KakaoPolyline {
  setMap: (map: KakaoMap | null) => void;
  setOptions: (options: {
    strokeWeight?: number;
    strokeOpacity?: number;
  }) => void;
}

export interface KakaoGeocoderResult {
  x: string;
  y: string;
  /** 지번 주소 쪽 — region_1depth_name(시·도) · region_2depth_name(구·군). */
  address?: { region_1depth_name?: string; region_2depth_name?: string } | null;
  road_address?: {
    region_1depth_name?: string;
    region_2depth_name?: string;
  } | null;
}

export interface KakaoPlacesResult {
  x: string;
  y: string;
  place_name: string;
  address_name?: string;
  road_address_name?: string;
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
    options: {
      center: KakaoLatLng;
      level: number;
      /** 끌어서 옮기기 · 휠 확대 · 두 번 눌러 확대 — 빼면 카카오 기본(모두 됨). */
      draggable?: boolean;
      scrollwheel?: boolean;
      disableDoubleClickZoom?: boolean;
    },
  ) => KakaoMap;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoLatLngBounds;
  Roadview: new (container: HTMLElement) => KakaoRoadview;
  RoadviewClient: new () => KakaoRoadviewClient;
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
  Polygon: new (options: {
    path: KakaoLatLng[] | KakaoLatLng[][];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    fillColor?: string;
    fillOpacity?: number;
    zIndex?: number;
  }) => KakaoPolygon;
  Polyline: new (options: {
    path: KakaoLatLng[];
    strokeWeight?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeStyle?: string;
    zIndex?: number;
  }) => KakaoPolyline;
  event: {
    addListener: (
      target: object,
      type: string,
      handler: (event?: KakaoMouseEvent) => void,
    ) => void;
    removeListener: (
      target: object,
      type: string,
      handler: (event?: KakaoMouseEvent) => void,
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

/**
 * 정확한 주소 → 좌표. geocodeAddress 와 달리 장소 키워드 검색을 거치지 않는다
 * (어드민 매체 주소처럼 이미 정해진 주소의 좌표만 필요할 때).
 */
export async function coordsOfAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address.trim();
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
      new services.Geocoder().addressSearch(trimmed, (result, status) => {
        resolve(
          status === services.Status.OK && result.length > 0
            ? { lat: Number(result[0].y), lng: Number(result[0].x) }
            : null,
        );
      });
    });
  });
}

export interface AddressLocation {
  lat: number;
  lng: number;
  /** 시·도 — "서울" */
  city?: string;
  /** 시·군·구 — "성동구" */
  district?: string;
}

/**
 * 손으로 적은 주소 → 위치(시·도 · 구·군 함께). 층 · 호수 · 건물명이 붙어 있으면 못 찾으니
 * 괄호를 떼고, 그래도 없으면 끝 단어를 하나씩 떼어 다시 찾는다("…아차산로11길 33 1층" → "…아차산로11길 33").
 * 영업 기록 협업 확정에서 쓴다(2026-11-12 — 서버 주소 검색이 못 찾아 지도가 안 뜨던 것).
 */
export async function locateAddress(
  address: string,
): Promise<AddressLocation | null> {
  const base = address
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!base) return null;
  await loadKakaoSdk();
  const maps = window.kakao?.maps;
  if (!maps) return null;
  const services = await new Promise<KakaoServices | undefined>((resolve) =>
    maps.load(() => resolve(maps.services)),
  );
  if (!services) return null;
  const geocoder = new services.Geocoder();
  const search = (query: string) =>
    new Promise<KakaoGeocoderResult | null>((resolve) =>
      geocoder.addressSearch(query, (result, status) =>
        resolve(
          status === services.Status.OK && result.length > 0 ? result[0] : null,
        ),
      ),
    );
  const words = base.split(" ");
  // "서울 성동구 OO길 12"처럼 적어도 세 단어는 남긴다.
  for (let n = words.length; n >= Math.min(3, words.length); n--) {
    const hit = await search(words.slice(0, n).join(" "));
    if (!hit) continue;
    const region = hit.road_address ?? hit.address ?? {};
    return {
      lat: Number(hit.y),
      lng: Number(hit.x),
      city: region.region_1depth_name || undefined,
      district: region.region_2depth_name || undefined,
    };
  }
  return null;
}

export interface KakaoPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
}

// 카카오 Places 키워드 검색 → 관련 장소 목록(자동완성용). 상위 limit개.
export async function searchPlaces(
  query: string,
  limit = 5,
): Promise<KakaoPlace[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  await loadKakaoSdk();
  const maps = window.kakao?.maps;
  if (!maps) return [];

  return new Promise((resolve) => {
    maps.load(() => {
      const services = maps.services;
      if (!services) {
        resolve([]);
        return;
      }
      const places = new services.Places();
      places.keywordSearch(trimmed, (result, status) => {
        if (status === services.Status.OK && result.length > 0) {
          resolve(
            result.slice(0, limit).map((r) => ({
              name: r.place_name,
              address: r.road_address_name || r.address_name || "",
              lat: Number(r.y),
              lng: Number(r.x),
            })),
          );
        } else {
          resolve([]);
        }
      });
    });
  });
}
