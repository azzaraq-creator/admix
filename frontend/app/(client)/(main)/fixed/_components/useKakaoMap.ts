"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

import { type KakaoLatLng, type KakaoMap, loadKakaoSdk } from "@/lib/kakaoMap";

import type {
  MapBoundsPayload,
  MapMoveType,
  MarkerEntry,
  MoveTarget,
} from "./mapTypes";

export const SEOUL_CITY_HALL = { lat: 37.5665, lng: 126.978 };

export function useKakaoMap({
  markerObjsRef,
  autoFit,
  moveTarget,
  onBoundsChange,
}: {
  markerObjsRef: RefObject<MarkerEntry[]>;
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
  // 모바일 목록 ↔ 지도 전환으로 숨겨질 때의 위치. 다시 보일 때 처음 위치가 아니라 여기로 돌아온다.
  // 숨겨진 동안 장소 검색 등으로 이동 목표(moveTarget)가 바뀌면 그쪽이 우선이라 비운다.
  const hiddenViewRef = useRef<{ center: KakaoLatLng; level: number } | null>(
    null,
  );
  useEffect(() => {
    hiddenViewRef.current = null;
  }, [moveTarget]);

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
            // 숨김(크기 0)인 지도는 사용자가 옮길 수 없다. 그런데 iOS 사파리에서 목록을 당기면
            // (바운스) 숨은 지도에 idle이 나서 엉뚱한 영역으로 목록이 다시 조회돼 0개가 됐다.
            // 숨은 동안의 사용자 이동은 버린다 — 코드가 옮긴 것(첫 진입·장소 검색)은 그대로 알린다.
            if (
              moveType !== "program" &&
              (container.clientWidth === 0 || container.clientHeight === 0)
            ) {
              zoomedRef.current = false;
              return;
            }
            const bounds = map.getBounds();
            const sw = bounds.getSouthWest();
            const ne = bounds.getNorthEast();
            let neLat = ne.getLat();
            let swLat = sw.getLat();
            let neLng = ne.getLng();
            let swLng = sw.getLng();
            // 모바일 진입 시 지도가 숨김(크기 0)이면 getBounds가 한 점을 반환한다.
            // 그 자리를 넓이 0 대신 "지도를 펼치면 보일 영역"으로 넓힌다. 모바일 지도는 목록과
            // 같은 칸을 차지하므로, 크기가 있는 가장 가까운 조상 칸의 크기를 지금 줌으로 환산한다.
            // (예전엔 중심 ±0.03°로 넓혀서, 첫 목록이 실제 지도보다 훨씬 넓은 영역의 매체를 보여 줬다.)
            if (
              Math.abs(neLat - swLat) < 1e-6 ||
              Math.abs(neLng - swLng) < 1e-6
            ) {
              let area: HTMLElement | null = container.parentElement;
              while (
                area &&
                (area.clientWidth === 0 || area.clientHeight === 0)
              )
                area = area.parentElement;
              const cLat = (neLat + swLat) / 2;
              const cLng = (neLng + swLng) / 2;
              if (area) {
                const proj = map.getProjection();
                const c = proj.containerPointFromCoords(
                  new maps.LatLng(cLat, cLng),
                );
                const halfW = area.clientWidth / 2;
                const halfH = area.clientHeight / 2;
                const neP = proj.coordsFromContainerPoint(
                  new maps.Point(c.x + halfW, c.y - halfH),
                );
                const swP = proj.coordsFromContainerPoint(
                  new maps.Point(c.x - halfW, c.y + halfH),
                );
                neLat = neP.getLat();
                neLng = neP.getLng();
                swLat = swP.getLat();
                swLng = swP.getLng();
              } else {
                neLat = cLat + 0.03;
                swLat = cLat - 0.03;
                neLng = cLng + 0.03;
                swLng = cLng - 0.03;
              }
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
        if (prevWidth > 0 && prevHeight > 0)
          hiddenViewRef.current = {
            center: map.getCenter(),
            level: map.getLevel(),
          };
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
        // relayout은 그 자리에서 idle을 일으키는데, 이때는 숨김(크기 0) 동안의 중심이 지도 왼쪽 위
        // 모서리에 가 있어 영역이 실제 보이는 곳의 오른쪽 아래 1/4만 잡힌다(모바일에서 "지도 보기"를
        // 누르면 매체가 몇 개만 뜨던 원인). 재센터링까지 끝난 뒤 한 번만 알리도록 크기 변경 중
        // 표시를 켜 둔다 — handleIdle이 멈춘 뒤 200ms에 지금 보이는 영역으로 목록을 다시 조회한다.
        resizingRef.current = true;
        // 보이게 되는 순간은 기다리지 않고 바로 맞춘다(아래 재센터링이 relayout 뒤여야 한다).
        map.relayout();
        // 모바일: 지도가 숨김(크기 0)으로 생성돼 센터가 어긋나므로, 보이게 될 때 재센터링.
        const maps = window.kakao?.maps;
        const mt = moveTargetRef.current;
        const hiddenView = hiddenViewRef.current;
        if (hiddenView) {
          map.setLevel(hiddenView.level);
          map.setCenter(hiddenView.center);
        } else if (maps && mt) {
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
