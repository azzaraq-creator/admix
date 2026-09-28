"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { type KakaoCustomOverlay, type KakaoMap } from "@/lib/kakaoMap";

import type { MapMarker } from "./mapTypes";
import { SEOUL_CITY_HALL } from "./useKakaoMap";

// 팝업이 원하는 최대 높이. 아래 공간이 이보다 모자라고 위가 더 넓으면 위로 띄운다.
const POPUP_PREFERRED_HEIGHT = 420;
// 팝업이 아무리 좁아져도 이만큼은 보여 준다(그 아래는 팝업 안에서 스크롤).
const POPUP_MIN_HEIGHT = 160;
// 핀 기준점에서 팝업 가장자리까지 거리(MapArea의 top/bottom과 맞춘다)와 지도 끝 여백.
const POPUP_GAP_BELOW = 32;
const POPUP_GAP_ABOVE = 24;
const POPUP_EDGE_MARGIN = 12;

export function useMapPopup({
  mapRef,
  mapReady,
  containerRef,
  markers,
  popupId,
  popupPosition,
  onPopupClose,
}: {
  mapRef: RefObject<KakaoMap | null>;
  mapReady: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  markers: MapMarker[];
  popupId?: string | null;
  popupPosition?: { lat: number; lng: number } | null;
  onPopupClose?: () => void;
}) {
  const overlayRef = useRef<KakaoCustomOverlay | null>(null);
  const onPopupCloseRef = useRef(onPopupClose);
  const [popupEl] = useState<HTMLDivElement | null>(() => {
    if (typeof document === "undefined") return null;
    const el = document.createElement("div");
    el.style.position = "relative";
    el.style.width = "0";
    el.style.height = "0";
    return el;
  });
  const [flipUp, setFlipUp] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const [maxHeight, setMaxHeight] = useState(POPUP_PREFERRED_HEIGHT);

  useEffect(() => {
    onPopupCloseRef.current = onPopupClose;
  });

  useEffect(() => {
    const maps = window.kakao?.maps;
    const map = mapRef.current;
    const el = popupEl;
    if (!mapReady || !maps || !map || !el) return;
    if (!overlayRef.current) {
      overlayRef.current = new maps.CustomOverlay({
        position: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
        content: el,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 20,
        clickable: true,
      });
    }
    const handleMapClick = () => onPopupCloseRef.current?.();
    maps.event.addListener(map, "click", handleMapClick);
    return () => {
      maps.event.removeListener(map, "click", handleMapClick);
    };
  }, [mapReady, popupEl, mapRef]);

  // 팝업 위에서의 스크롤/드래그가 지도(줌·이동)로 전파되지 않도록 네이티브 이벤트 차단.
  // (React onWheel stopPropagation은 카카오 네이티브 리스너를 못 막음)
  useEffect(() => {
    const el = popupEl;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("wheel", stop);
    el.addEventListener("touchmove", stop);
    el.addEventListener("mousedown", stop);
    return () => {
      el.removeEventListener("wheel", stop);
      el.removeEventListener("touchmove", stop);
      el.removeEventListener("mousedown", stop);
    };
  }, [popupEl]);

  useEffect(() => {
    const maps = window.kakao?.maps;
    const overlay = overlayRef.current;
    const map = mapRef.current;
    if (!maps || !overlay || !map) return;
    // 명시적 위치(겹침 그룹) 우선, 없으면 popupId 마커 위치.
    const target =
      popupPosition ??
      (popupId ? markers.find((m) => m.id === popupId) : undefined);
    if (!target) {
      overlay.setMap(null);
      return;
    }
    const pos = new maps.LatLng(target.lat, target.lng);
    overlay.setPosition(pos);
    overlay.setMap(map);
    const container = containerRef.current;
    const projection = map.getProjection();
    if (container && projection) {
      const point = projection.containerPointFromCoords(pos);
      // 위·아래 중 팝업이 다 들어가는 쪽, 안 되면 더 넓은 쪽으로 띄우고 그 공간에 높이를 맞춘다.
      const spaceBelow =
        container.clientHeight - point.y - POPUP_GAP_BELOW - POPUP_EDGE_MARGIN;
      const spaceAbove = point.y - POPUP_GAP_ABOVE - POPUP_EDGE_MARGIN;
      const up = spaceBelow < POPUP_PREFERRED_HEIGHT && spaceAbove > spaceBelow;
      setFlipUp(up);
      setMaxHeight(
        Math.max(
          POPUP_MIN_HEIGHT,
          Math.min(POPUP_PREFERRED_HEIGHT, up ? spaceAbove : spaceBelow),
        ),
      );
      // 수평: 팝업(폭 360px)이 지도 좌우를 벗어나지 않도록 시프트 계산.
      const halfW = Math.min(180, Math.max(0, (container.clientWidth - 24) / 2));
      const margin = 12;
      let sx = 0;
      if (point.x - halfW < margin) sx = margin - (point.x - halfW);
      else if (point.x + halfW > container.clientWidth - margin)
        sx = container.clientWidth - margin - (point.x + halfW);
      setShiftX(sx);
    }
  }, [popupId, popupPosition, markers, mapReady, mapRef, containerRef]);

  return { popupEl, flipUp, shiftX, maxHeight };
}
