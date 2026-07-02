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
