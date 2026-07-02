"use client";

import { type ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

import type { KakaoMarker } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

import type {
  MapBoundsPayload,
  MapCluster,
  MapMarker,
  MoveTarget,
} from "./mapTypes";
import { useKakaoMap } from "./useKakaoMap";
import { useMapMarkers } from "./useMapMarkers";
import { useMapPopup } from "./useMapPopup";

export { geocodeAddress } from "@/lib/kakaoMap";
export type {
  MapBoundsPayload,
  MapCluster,
  MapMarker,
  MapMoveType,
  MoveTarget,
} from "./mapTypes";

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
  const markerObjsRef = useRef<{ marker: KakaoMarker; data: MapMarker }[]>([]);

  const { containerRef, mapRef, mapReady, programmaticMoveRef } = useKakaoMap({
    markerObjsRef,
    autoFit,
    moveTarget,
    onBoundsChange,
  });

  useMapMarkers({
    mapRef,
    mapReady,
    programmaticMoveRef,
    markerObjsRef,
    markers,
    clusters,
    autoFit,
    focusId,
    focusOffsetX,
    focusCenter,
    moveTarget,
    onMarkerClick,
    onClusterClick,
    onGroupClick,
  });

  const { popupEl, flipUp, shiftX } = useMapPopup({
    mapRef,
    mapReady,
    containerRef,
    markers,
    popupId,
    popupPosition,
    onPopupClose,
  });

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
