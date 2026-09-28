"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { type KakaoMap, type KakaoMarker, loadKakaoSdk } from "@/lib/kakaoMap";

import type {
  MapBoundsPayload,
  MapMarker,
  MapMoveType,
  MoveTarget,
} from "./mapTypes";

export const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

export function useKakaoMap({
  markerObjsRef,
  autoFit,
  moveTarget,
  onBoundsChange,
}: {
  markerObjsRef: RefObject<{ marker: KakaoMarker; data: MapMarker }[]>;
  autoFit: boolean;
  moveTarget?: MoveTarget | null;
  onBoundsChange?: (bounds: MapBoundsPayload) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const programmaticMoveRef = useRef(false);
  const zoomedRef = useRef(false);
  const listenerCleanupRef = useRef<(() => void) | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 컨테이너 크기가 바뀌는 중(LNB 접기/펼치기 등) — 이때 나는 idle은 한 번으로 모은다. */
  const resizingRef = useRef(false);
  const moveTargetRef = useRef(moveTarget);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const autoFitRef = useRef(autoFit);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
    autoFitRef.current = autoFit;
    moveTargetRef.current = moveTarget;
  });

  useEffect(() => {
    let cancelled = false;
    loadKakaoSdk()
      .then(() => {
        const maps = window.kakao?.maps;
        const container = containerRef.current;
        if (cancelled || !maps || !container) return;
        maps.load(() => {
          if (cancelled || !container) return;
          const map = new maps.Map(container, {
            center: new maps.LatLng(SEOUL_CITY_HALL.lat, SEOUL_CITY_HALL.lng),
            level: 5,
          });
          mapRef.current = map;
          // 초기 위치의 첫 idle은 사용자 이동이 아님(버튼 오노출 방지).
          programmaticMoveRef.current = true;

          // idle/zoom 리스너를 지도 생성과 동시에 부착 → 첫 idle(초기 커밋) 놓침 방지.
          const markZoom = () => {
            zoomedRef.current = true;
          };
          const emit = (moveType: MapMoveType) => {
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            let neLat = ne.getLat();
            let swLat = sw.getLat();
            let neLng = ne.getLng();
            let swLng = sw.getLng();
            // 모바일 진입 시 지도가 숨김(크기 0)이면 getBounds가 한 점을 반환한다.
            // degenerate(넓이 0) bbox면 중심 기준 기본 span으로 확장(빈 결과 방지).
            if (
              Math.abs(neLat - swLat) < 1e-6 ||
              Math.abs(neLng - swLng) < 1e-6
            ) {
              const cLat = (neLat + swLat) / 2;
              const cLng = (neLng + swLng) / 2;
              const D_LAT = 0.03;
              const D_LNG = 0.03;
              neLat = cLat + D_LAT;
              swLat = cLat - D_LAT;
              neLng = cLng + D_LNG;
              swLng = cLng - D_LNG;
            }
            programmaticMoveRef.current = false;
            zoomedRef.current = false;
            onBoundsChangeRef.current?.({
              neLat,
              neLng,
              swLat,
              swLng,
              zoom: map.getLevel(),
              moveType,
            });
          };
          const handleIdle = () => {
            // 크기 변화로 relayout할 때마다 idle이 나는데, 그때마다 목록을 다시 조회하면
            // 애니메이션 동안 여러 번 조회돼 카드가 버벅인다. 크기가 멈춘 뒤 한 번만 알린다.
            if (resizingRef.current) {
              if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
              idleTimerRef.current = setTimeout(() => {
                resizingRef.current = false;
                emit("drag");
              }, 200);
              return;
            }
            // 프로그램 이동(지오코딩/클러스터/moveTarget)은 setCenter+setLevel이
            // idle을 여러 번 발생시키므로, debounce로 최종 settled 상태만 통지.
            if (programmaticMoveRef.current) {
              if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
              idleTimerRef.current = setTimeout(() => emit("program"), 180);
              return;
            }
            // 코드가 옮긴 게 아니면 사용자 이동이다 — 줌이 아니면 모두 "drag"로 본다.
            // dragend가 없는 이동(방향키로 지도 이동, 패널을 여닫아 지도 크기가 바뀜 등)도
            // 목록을 지금 보이는 영역으로 다시 조회해야 하기 때문이다.
            emit(zoomedRef.current ? "zoom" : "drag");
          };
          maps.event.addListener(map, "zoom_changed", markZoom);
          maps.event.addListener(map, "idle", handleIdle);
          listenerCleanupRef.current = () => {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            maps.event.removeListener(map, "zoom_changed", markZoom);
            maps.event.removeListener(map, "idle", handleIdle);
          };

          setMapReady(true);
        });
      })
      .catch((error) => {
        console.error("[MapArea] Kakao map init failed:", error);
      });
    return () => {
      cancelled = true;
      listenerCleanupRef.current?.();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const fitToMarkers = () => {
      if (!autoFitRef.current) return;
      const maps = window.kakao?.maps;
      const map = mapRef.current;
      if (!maps || !map) return;
      const entries = markerObjsRef.current;
      if (entries.length === 0) return;
      if (entries.length === 1) {
        map.setCenter(
          new maps.LatLng(entries[0].data.lat, entries[0].data.lng),
        );
        map.setLevel(5);
        return;
      }
      const bounds = new maps.LatLngBounds();
      entries.forEach(({ data }) =>
        bounds.extend(new maps.LatLng(data.lat, data.lng)),
      );
      map.setBounds(bounds);
    };

    let prevWidth = container.clientWidth;
    let prevHeight = container.clientHeight;
    // relayout(타일 재배치)은 무거워 크기가 연속으로 바뀔 때(LNB 접기/펼치기 애니메이션 등)
    // 매 프레임 하면 버벅인다. 최대 100ms에 한 번만 하고, 마지막 크기도 100ms 안에 반영된다.
    let relayoutTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRelayout = () => {
      resizingRef.current = true;
      if (relayoutTimer) return;
      relayoutTimer = setTimeout(() => {
        relayoutTimer = undefined;
        mapRef.current?.relayout();
      }, 100);
    };
    const observer = new ResizeObserver((entries) => {
      const map = mapRef.current;
      if (!map) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) {
        prevWidth = width;
        prevHeight = height;
        return;
      }
      const becameVisible = prevWidth === 0 || prevHeight === 0;
      const sizeChanged = width !== prevWidth || height !== prevHeight;
      prevWidth = width;
      prevHeight = height;
      // 컨테이너 크기 변경(채팅 패널 접기/펼치기 등) 시 타일 재배치. relayout이 없으면
      // 새로 드러난 영역이 회색으로 남는다. relayout은 중심/줌을 보존해 지도가 튀지 않는다.
      if (becameVisible) {
        // 보이게 되는 순간은 기다리지 않고 바로 맞춘다(아래 재센터링이 relayout 뒤여야 한다).
        map.relayout();
        // 모바일: 지도가 숨김(크기 0)으로 생성돼 센터가 어긋나므로, 보이게 될 때 재센터링.
        const maps = window.kakao?.maps;
        const mt = moveTargetRef.current;
        if (maps && mt) {
          programmaticMoveRef.current = true;
          map.setCenter(new maps.LatLng(mt.lat, mt.lng));
          if (mt.level != null) map.setLevel(mt.level);
        }
        fitToMarkers();
      } else if (sizeChanged) {
        scheduleRelayout();
      }
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (relayoutTimer) clearTimeout(relayoutTimer);
    };
  }, [mapReady, markerObjsRef]);

  return { containerRef, mapRef, markerObjsRef, mapReady, programmaticMoveRef };
}
