export interface MapMarker {
  id: string; // media_id (Drawer 연동용)
  lat: number;
  lng: number;
  name: string;
  categoryLarge?: string | null;
  minAdvertisementFeeKrw?: number | null;
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
