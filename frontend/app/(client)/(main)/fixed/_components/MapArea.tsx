"use client";

import { type CSSProperties, type ReactNode, useRef } from "react";
import { createPortal } from "react-dom";

import type { KakaoMarker } from "@/lib/kakaoMap";
import { cn } from "@/lib/utils";

import type {
  MapBoundsPayload,
  MapCluster,
  MapMarker,
  MoveTarget,
} from "./mapTypes";
import { POPUP_BG_CLASS } from "./MarkerMediaPopup";
import { useKakaoMap } from "./useKakaoMap";
import { useMapMarkers } from "./useMapMarkers";
import { useMapPopup } from "./useMapPopup";

export { geocodeAddress, searchPlaces, type KakaoPlace } from "@/lib/kakaoMap";
export type {
  MapBoundsPayload,
  MapCluster,
  MapMarker,
  MapMoveType,
  MoveTarget,
} from "./mapTypes";

// 팝업 폭(360px)의 절반에서 모서리 곡률(16px)과 꼬리 폭 여유를 뺀 값.
const POPUP_ARROW_MAX_OFFSET = 150;

export function MapArea({
  className,
  markers = [],
  clusters = [],
  selectedGroup,
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
  selectedGroup?: MapMarker[] | null;
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
    selectedGroup,
    autoFit,
    focusId,
    focusOffsetX,
    focusCenter,
    moveTarget,
    onMarkerClick,
    onClusterClick,
    onGroupClick,
  });

  const { popupEl, flipUp, shiftX, maxHeight, width } = useMapPopup({
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
                // 그림자는 팝업과 꼬리를 한 덩어리로 감싸도록 여기서 준다(drop-shadow).
                "absolute left-1/2 drop-shadow-[0px_3px_8px_rgba(0,0,0,0.22)]",
                // 핀 그림은 기준점 위 약 10px·아래 약 17px까지 보인다. 꼬리 끝(가장자리에서 7px)과
                // 핀 사이가 6px쯤 비도록 띄운다.
                flipUp ? "bottom-[24px]" : "top-[32px]",
              )}
              // --map-popup-max-h: 지도 안에 남은 공간. 팝업 내용이 최대 높이로 쓴다.
              // --map-popup-w: 지도 폭에 맞춘 팝업 폭(좌우 시프트 계산과 같은 값).
              style={
                {
                  transform: `translateX(calc(-50% + ${shiftX}px))`,
                  "--map-popup-max-h": `${maxHeight}px`,
                  "--map-popup-w": `${width}px`,
                } as CSSProperties
              }
            >
              {popupContent}
              {/* 마커를 가리키는 꼬리. 팝업을 좌우로 민 만큼(shiftX) 되돌려 늘 마커 위에 두고,
                  팝업 모서리 곡률 밖으로 나가지 않게 가운데에서 ±POPUP_ARROW_MAX_OFFSET까지만 움직인다.
                  팝업과 맞닿는 두 변엔 테두리를 빼서 팝업과 한 몸처럼 보이게 한다. */}
              <span
                aria-hidden
                className={cn(
                  "pointer-events-none absolute left-1/2 size-[10px] rotate-45 border-black-200",
                  POPUP_BG_CLASS,
                  flipUp
                    ? "-bottom-[5px] border-r border-b"
                    : "-top-[5px] border-t border-l",
                )}
                style={{
                  marginLeft: `${
                    Math.max(
                      -POPUP_ARROW_MAX_OFFSET,
                      Math.min(POPUP_ARROW_MAX_OFFSET, -shiftX),
                    ) - 5
                  }px`,
                }}
              />
            </div>,
            popupEl,
          )
        : null}
    </div>
  );
}
