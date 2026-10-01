import type { KakaoCustomOverlay, KakaoMarker } from "@/lib/kakaoMap";

export interface MapMarker {
  id: string; // media_id (Drawer 연동용)
  lat: number;
  lng: number;
  name: string;
  categoryLarge?: string | null;
  categorySmall?: string | null;
  address?: string | null;
  minAdvertisementFeeKrw?: number | null;
  minProductionFeeKrw?: number | null;
  thumbnailUrl?: string | null;
  images?: string[];
  badge?: "popular" | "new" | null;
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
  // 있으면 setCenter+level 대신 이 영역에 맞춰 지도를 fit(키워드 결과가 흩어질 때).
  // lat/lng는 fallback(모바일 재센터링) 용도로 centroid를 채워 둔다.
  fitBounds?: { neLat: number; swLat: number; neLng: number; swLng: number };
}

/** 이 레벨 이하(더 가까이)로 확대하면 혼자 있는 핀을 마커 대신 매체명 말풍선으로 보인다. */
export const BUBBLE_MAX_LEVEL = 3;

/**
 * 지도에 올린 단일 매체 한 개 — 멀리서는 카카오 마커(아이콘 핀), 가까이(BUBBLE_MAX_LEVEL 이하)에서는
 * 매체명 말풍선(CustomOverlay)으로 그린다. 둘 중 하나만 있다.
 */
export interface MarkerEntry {
  data: MapMarker;
  marker: KakaoMarker | null;
  bubble: { overlay: KakaoCustomOverlay; el: HTMLDivElement } | null;
}
