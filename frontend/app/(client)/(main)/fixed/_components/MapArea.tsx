"use client";

import { Card, Chip, Drawer, ScrollShadow, Switch } from "@heroui/react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  useCrowdTransit,
  type CrowdPlace,
  type CrowdTransit,
  type OperatingArea,
  type TrafficLink,
} from "@/hooks/media";
import { ChevronDownIcon, XIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import type {
  MapBoundsPayload,
  MapCluster,
  MapMarker,
  MarkerEntry,
  MoveTarget,
} from "./mapTypes";
import { POPUP_BG_CLASS } from "./MarkerMediaPopup";
import { useKakaoMap } from "./useKakaoMap";
import { useMapArea } from "./useMapArea";
import { CrowdTransitSections } from "./CrowdTransitSections";
import {
  CROWD_LEVELS,
  crowdColor,
  useCrowdRings,
  useMapCrowd,
} from "./useMapCrowd";
import { useMapMarkers } from "./useMapMarkers";
import { useMapPopup } from "./useMapPopup";
import {
  PopGridLayer,
  PopGridGuideSpot,
  PopGridMapCard,
  PopGridSheet,
  type PopGridState,
} from "./PopGridLayer";
import type { PopRealtime } from "./useMapPopGrid";
import { TRAFFIC_LEVELS, trafficColor, useMapTraffic } from "./useMapTraffic";

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

/** 실시간 정보 창의 스위치 한 줄 — [이름 ··· 스위치]. sub는 실시간 인구 아래 딸린 설정(흑백·장소명). */
function LayerSwitch({
  label,
  sub = false,
  isSelected,
  onChange,
  ariaLabel,
}: {
  label: string;
  sub?: boolean;
  isSelected: boolean;
  onChange: (on: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <Switch
      size="sm"
      isSelected={isSelected}
      onChange={onChange}
      aria-label={ariaLabel}
      className="w-full [--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
    >
      <Switch.Content
        className={cn(
          "w-full justify-between gap-[8px] text-[12px] font-semibold text-zinc-900",
          sub && "font-medium text-zinc-700 dark:text-[#c9cad3]",
        )}
      >
        <span>{label}</span>
        <Switch.Control>
          {/* 켜져도 손잡이는 흰색(테마 기본은 진한 색이라 보라 위에서 안 보인다). */}
          <Switch.Thumb className="bg-surface!" />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}

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
  highlightArea,
  crowd,
  traffic,
  popGrid,
  forceLayersOpen = false,
  onLiveViewport,
  demoPlace,
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
  /** 이동매체 운행 지역 — 반투명 영역으로 그린다(이동매체는 핀이 없다). */
  highlightArea?: OperatingArea | null;
  /** "실시간 인구" — 서울시 주요 장소의 실시간 혼잡도. 서버에 서울시 키가 없으면 넘기지 않는다. */
  crowd?: {
    on: boolean;
    onToggle: (on: boolean) => void;
    /** 범위 밖 흑백 */
    gray: boolean;
    onToggleGray: (on: boolean) => void;
    /** 장소 이름표 보이기(기본 켬) — 가이드 예시엔 없다. */
    labels?: boolean;
    onToggleLabels?: (on: boolean) => void;
    places: CrowdPlace[];
    /** 아직 불러오는 장소가 있음 */
    loading: boolean;
  };
  /** "도로 현황" — 서울시 도로 구간의 실시간 소통(서울시 실시간 도로 소통 정보, TOPIS). 키가 없으면 넘기지 않는다. */
  traffic?: {
    on: boolean;
    onToggle: (on: boolean) => void;
    links: TrafficLink[];
    /** 아직 불러오는 장소가 있음 */
    loading: boolean;
  };
  /** "유동인구" — 서울 250m 격자의 월별 인구(어드민이 올린 달). 켜기는 지도 스위치, 조건은 검색 줄 아래 유동인구 지도 창. */
  popGrid?: PopGridState;
  /** 실시간 정보 창을 펼친 채로 — 가이드가 실시간 자료를 밝히는 동안. */
  forceLayersOpen?: boolean;
  /**
   * 실시간 인구·도로 현황을 켜는 순간 — 지금 지도에 보이는 영역. 마지막으로 멈춘 영역(onBoundsChange)은 지도 크기가
   * 막 바뀐 뒤(목록↔지도, 검색 접기 등)엔 실제와 달라, 켜자마자 엉뚱한 영역을 물어 지도를 움직여야 뜨던 문제를 막는다.
   */
  onLiveViewport?: (bounds: MapBoundsPayload) => void;
  /** 가이드 — 이 장소를 고른 것처럼 장소 카드를 띄운다(예시 지하철·버스 데이터, 불러오지 않는다). */
  demoPlace?: {
    place: CrowdPlace;
    transit: CrowdTransit;
    /** 먼저 그려 자리를 재고, 밝힌 자리가 옮겨 갈 때 드러낸다. */
    visible: boolean;
  } | null;
}) {
  const markerObjsRef = useRef<MarkerEntry[]>([]);

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

  useMapArea({ mapRef, mapReady, area: highlightArea });

  const liveOn = !!crowd?.on || !!traffic?.on;
  const onLiveViewportRef = useRef(onLiveViewport);
  useEffect(() => {
    onLiveViewportRef.current = onLiveViewport;
  });
  useEffect(() => {
    const map = mapRef.current;
    const el = containerRef.current;
    // 지도가 숨어 있으면(모바일 목록 보기) 영역이 0이라 묻지 않는다 — 보이게 될 때 onBoundsChange 가 맡는다.
    if (!liveOn || !mapReady || !map || !el || el.offsetWidth === 0) return;
    const b = map.getBounds();
    const ne = b.getNorthEast();
    const sw = b.getSouthWest();
    onLiveViewportRef.current?.({
      neLat: ne.getLat(),
      neLng: ne.getLng(),
      swLat: sw.getLat(),
      swLng: sw.getLng(),
      zoom: map.getLevel(),
      moveType: "program",
    });
  }, [liveOn, mapReady, mapRef, containerRef]);

  useMapTraffic({
    mapRef,
    mapReady,
    links: traffic?.on ? traffic.links : null,
    strong: !!popGrid?.on,
  });

  // 실시간 인구 장소 범위를 눌러 고른 장소 — 끄면 닫는다. 내용은 늘 최근에 받은 값으로.
  const [pickedPlace, setPickedPlace] = useState<CrowdPlace | null>(null);
  const picked = demoPlace
    ? demoPlace.place
    : crowd?.on && pickedPlace
      ? (crowd.places.find((p) => p.code === pickedPlace.code) ?? pickedPlace)
      : null;

  const isDesktop = useIsDesktop();

  // 인구 분포를 켠 동안 — 도로 현황 선·실시간 인구 범위를 격자 위에 다시 그린다(카카오 도형은 격자 판 아래 층).
  const popOn = !!popGrid?.on;
  const rtLinks = traffic?.on ? traffic.links : null;
  const rtPlaces = crowd?.on ? crowd.places : null;
  const crowdRings = useCrowdRings(popOn && !!rtPlaces);

  // 모바일에서 인구 분포·실시간 인구를 함께 켜면 지도 누름은 인구 분포 층(PopGridLayer)이 한 번에 받는다 —
  // 누른 자리에 장소 범위와 격자 칸이 겹치면 둘 중 볼 것을 고르게 한다. 그래서 범위 누름은 여기서 흘려보낸다.
  const tapViaGrid = popOn && !isDesktop && !!rtPlaces && !!crowdRings;
  const selectPlace = (place: CrowdPlace | null) => {
    if (place && tapViaGrid) return;
    setPickedPlace(place);
  };
  const placeAt = tapViaGrid
    ? (lat: number, lng: number) =>
        rtPlaces.find((pl) =>
          crowdRings.get(pl.code)?.some((ring) => inRing(ring, lng, lat)),
        ) ?? null
    : undefined;

  const { boardShown: crowdBoardShown } = useMapCrowd({
    mapRef,
    mapReady,
    places: crowd?.on ? crowd.places : null,
    gray: !!crowd?.gray,
    strong: !!popGrid?.on,
    selectedCode: picked?.code,
    onSelect: selectPlace,
  });
  const popRealtime = useMemo<PopRealtime | null>(() => {
    if (!popOn) return null;
    const lines = (rtLinks ?? []).map((l) => ({
      path: l.path,
      color: trafficColor(l.level),
    }));
    const areas =
      rtPlaces && crowdRings
        ? rtPlaces.flatMap((pl) => {
            const rings = crowdRings.get(pl.code);
            return rings ? [{ rings, color: crowdColor(pl.level) }] : [];
          })
        : [];
    return lines.length || areas.length ? { lines, areas } : null;
  }, [popOn, rtLinks, rtPlaces, crowdRings]);
  // 실시간 정보 창(오른쪽 위) — 평소엔 접어 두고, 가이드가 밝히는 동안엔 펼친다. 창 밖을 누르면 닫는다.
  const [layersOpen, setLayersOpen] = useState(false);
  const layersShown = layersOpen || forceLayersOpen;
  const liveOnCount = Number(!!crowd?.on) + Number(!!traffic?.on);
  const layersBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!layersOpen) return;
    const close = (e: PointerEvent) => {
      if (!layersBoxRef.current?.contains(e.target as Node))
        setLayersOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [layersOpen]);

  // 실시간 범례(PC) — 실시간 정보 버튼 밑에 띄운다. 모바일은 띄우지 않는다.
  const liveLegendShown = liveOn && isDesktop;

  // 왼쪽 위 인구 분포 조건 높이(줄이 바뀌면 커진다) — 실시간 인구 장소 카드는 그 밑에 붙인다.
  // 오른쪽 위 실시간 정보 버튼 폭 — 조건 카드가 그 앞에서 줄을 바꾼다.
  const popCardRef = useRef<HTMLButtonElement>(null);
  const [popCardHeight, setPopCardHeight] = useState(30);
  const popCardShown = !!popGrid?.on;
  useLayoutEffect(() => {
    const el = popCardRef.current;
    if (!popCardShown || !el) return;
    const observer = new ResizeObserver(() =>
      setPopCardHeight(el.offsetHeight),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [popCardShown]);
  const [layersButtonWidth, setLayersButtonWidth] = useState(0);
  const layersButtonRef = useRef<HTMLButtonElement>(null);
  const hasLayers = !!crowd || !!traffic;
  useLayoutEffect(() => {
    const el = layersButtonRef.current;
    if (!hasLayers || !el) {
      setLayersButtonWidth(0);
      return;
    }
    const observer = new ResizeObserver(() =>
      setLayersButtonWidth(el.offsetWidth),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasLayers]);

  const { popupEl, flipUp, shiftX, maxHeight, width, gap } = useMapPopup({
    mapRef,
    mapReady,
    containerRef,
    markers,
    popupId,
    popupPosition,
    onPopupClose,
  });

  return (
    <div
      className={cn("relative @container", className)}
      style={
        {
          // 실시간 인구 장소 카드는 왼쪽 위 인구 분포 조건 바로 밑, 없으면 맨 위.
          "--map-legend-top": `${popCardShown ? 12 + popCardHeight + 8 : 12}px`,
          "--map-right-top-w": `${layersButtonWidth ? layersButtonWidth + 8 : 0}px`,
        } as CSSProperties
      }
    >
      {/* 모바일은 지도가 좁아 실시간 인구 토글·범례(z-[2])가 매체 정보 팝업을 가린다 —
          팝업(지도 안에 그려진다)이 열려 있는 동안은 지도째 그 위로 올린다. */}
      <div
        ref={containerRef}
        className={cn(
          "h-full w-full bg-tone-e9edf0",
          (popupId || popupPosition) && "max-sm:relative max-sm:z-[3]",
          // 실시간 인구를 켜면 범위 밖은 흑백 판(useMapCrowd)이 덮는다. 판이 아직 없거나 확대·축소 중엔
          // 판이 어긋나므로 지도 전체를 흑백으로(globals.css) — 색이 번쩍 돌아오지 않게.
          crowd?.on && crowd.gray && !crowdBoardShown && "map-crowd-gray",
          // 이름표 끄기 — 장소 표시(.map-crowd-pill)만 숨기고 범위는 남긴다(globals.css).
          crowd?.on && crowd.labels === false && "map-crowd-no-labels",
        )}
      />
      {popGrid?.on && (
        <PopGridLayer
          mapRef={mapRef}
          mapReady={mapReady}
          state={popGrid}
          realtime={popRealtime}
          soft={!!crowd?.on}
          placeAt={placeAt}
          onPickPlace={setPickedPlace}
        />
      )}
      {popGrid?.demo && (
        // 가이드 "칸별 인구" — 예시로 고른 격자 칸 자리도 밝힌다(가이드 밝힘은 칸 정보 카드 한 자리라).
        <PopGridGuideSpot
          mapRef={mapRef}
          mapEl={containerRef}
          state={popGrid}
        />
      )}
      {popGrid?.on && !isDesktop && <PopGridSheet state={popGrid} />}
      {(crowd || traffic) && (
        // 실시간 정보(실시간 인구·흑백·장소명·도로 현황) — 자주 쓰지 않아 지도 오른쪽 위 버튼 하나로 접어 둔다.
        // 켜진 수를 작은 숫자로. 창 밖을 누르면 닫는다.
        <div
          ref={layersBoxRef}
          className="absolute top-[12px] right-[12px] z-[2] flex flex-col items-end gap-[8px]"
        >
          <button
            ref={layersButtonRef}
            type="button"
            data-tour="map-realtime"
            onClick={() => setLayersOpen((v) => !v)}
            aria-expanded={layersShown}
            aria-label="실시간 정보 (서울)"
            // 모바일은 지도가 좁아 아이콘만(30px 원) — 켜진 수는 오른쪽 위 작은 숫자, 이름은 펼친 창 맨 위에.
            className="relative flex h-[30px] items-center gap-[6px] rounded-full border-[0.5px] border-white/40 bg-surface/60 pr-[12px] pl-[10px] max-sm:w-[30px] max-sm:justify-center max-sm:p-0 text-[12px] font-semibold text-zinc-900 shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px] backdrop-saturate-[1.8]"
          >
            {/* 아이콘 모양은 public/icons/layer.svg — 글자색으로 칠한다. */}
            <span
              aria-hidden
              className="h-[14px] w-[16px] shrink-0 bg-current [mask:url(/icons/layer.svg)_center/contain_no-repeat]"
            />
            <span className="max-sm:hidden">
              실시간 정보
              {/* 서울시 자료라 서울만 보인다는 걸 알린다(안의 스위치마다 붙이지 않고 여기 한 번). */}
              <span className="ml-[3px] font-medium text-zinc-500">(서울)</span>
            </span>
            {liveOnCount > 0 && (
              <span className="flex size-[18px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white max-sm:absolute max-sm:-top-[5px] max-sm:-right-[5px] max-sm:size-[16px] max-sm:text-[9px]">
                {liveOnCount}
              </span>
            )}
            <ChevronDownIcon
              className={cn(
                "size-[12px] shrink-0 transition-transform max-sm:hidden",
                layersShown && "rotate-180",
              )}
            />
          </button>
          {layersShown && (
            <div
              data-tour="map-realtime"
              className="flex w-[210px] flex-col gap-[10px] rounded-[16px] border-[0.5px] border-white/50 bg-surface/85 px-[14px] py-[12px] shadow-[0px_8px_24px_0px_rgba(0,0,0,0.14)] backdrop-blur-[14px] backdrop-saturate-[1.8]"
            >
              {/* 모바일은 버튼이 아이콘뿐이라 창 맨 위에 이름을 단다. */}
              <span className="-mb-[2px] text-[11px] font-semibold text-zinc-500 sm:hidden">
                실시간 정보 (서울)
              </span>
              {crowd && (
                <LayerSwitch
                  label="실시간 인구"
                  isSelected={crowd.on}
                  onChange={crowd.onToggle}
                  ariaLabel="실시간 인구 보기"
                />
              )}
              {crowd?.on && (
                // 실시간 인구를 켰을 때만 — 범위 밖 흑백, 장소 이름표(끄면 범위 색만 남아 격자·핀이 안 가려진다).
                <div className="-mt-[2px] flex flex-col gap-[8px] border-l-2 border-zinc-900/10 pl-[10px] dark:border-white/15">
                  <LayerSwitch
                    label="흑백"
                    sub
                    isSelected={crowd.gray}
                    onChange={crowd.onToggleGray}
                    ariaLabel="범위 밖 흑백으로 보기"
                  />
                  {crowd.onToggleLabels && (
                    <LayerSwitch
                      label="장소명"
                      sub
                      isSelected={crowd.labels !== false}
                      onChange={crowd.onToggleLabels}
                      ariaLabel="실시간 인구 장소명 보기"
                    />
                  )}
                </div>
              )}
              {traffic && (
                // 도로 현황 — 서울시 도로 구간을 속도로 정한 소통 등급 색(원활·서행·정체) 선으로.
                <LayerSwitch
                  label="도로 현황"
                  isSelected={traffic.on}
                  onChange={traffic.onToggle}
                  ariaLabel="도로 현황 보기"
                />
              )}
            </div>
          )}
          {liveLegendShown && (
            // 범례(PC) — 실시간 인구 혼잡도 4단계·도로 현황 3단계. 장소 표시에 마우스를 올리면 인구·기준 시각이 보인다.
            // 모바일은 지도가 좁아 범례를 띄우지 않는다(장소 이름표에 혼잡도가 적혀 있다).
            // 오른쪽 위 실시간 정보 버튼(창을 펼쳤으면 창) 바로 밑 — 오른쪽 아래는 누른 칸 정보 카드 자리.
            <div className="flex flex-col gap-[4px] rounded-[12px] border-[0.5px] border-white/40 bg-surface/40 px-[10px] py-[8px] text-[11px] shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px] backdrop-saturate-[1.8]">
              {crowd?.on && (
                <>
                  <LegendRow levels={CROWD_LEVELS} />
                  <span className="text-[10px] text-gray-500 dark:text-[#b9bac4]">
                    {crowd.loading
                      ? "서울시 실시간 혼잡도를 불러오는 중…"
                      : crowd.places.length === 0
                        ? "이 지역엔 서울시 주요 장소가 없어요"
                        : "서울시 주요 장소 실시간 혼잡도 · 5분마다 갱신"}
                  </span>
                </>
              )}
              {traffic?.on && (
                <>
                  <LegendRow levels={TRAFFIC_LEVELS} line />
                  <span className="text-[10px] text-gray-500 dark:text-[#b9bac4]">
                    {traffic.loading
                      ? "서울시 도로 현황을 불러오는 중…"
                      : traffic.links.length === 0
                        ? "이 지역엔 서울시 도로 정보가 없어요"
                        : "서울시 실시간 도로 소통(주요 도로) · 5분마다 갱신"}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
      {popGrid?.on && (
        // 인구 분포 조건 — 켰을 때만 고른 조건 한 줄. 누르면 유동인구 창(켜기·끄기도 그 창에서).
        // 실시간 인구·도로 현황은 오른쪽 위 "실시간 정보" 버튼으로 따로 뺐다.
        <PopGridMapCard state={popGrid} cardRef={popCardRef} />
      )}
      {picked && (
        <CrowdPlaceCard
          place={picked}
          transit={demoPlace?.transit}
          hidden={demoPlace ? !demoPlace.visible : false}
          onClose={() => setPickedPlace(null)}
        />
      )}
      {(popupId || popupPosition) && popupEl
        ? createPortal(
            <div
              className={cn(
                // 그림자는 팝업과 꼬리를 한 덩어리로 감싸도록 여기서 준다(drop-shadow).
                "absolute left-1/2 drop-shadow-[0px_3px_8px_rgba(0,0,0,0.22)]",
              )}
              // --map-popup-max-h: 지도 안에 남은 공간. 팝업 내용이 최대 높이로 쓴다.
              // --map-popup-w: 지도 폭에 맞춘 팝업 폭(좌우 시프트 계산과 같은 값).
              style={
                {
                  // 기준점에서 띄우는 거리 — 핀(마커)이냐 매체명 말풍선이냐에 따라 useMapPopup이 정한다.
                  // 꼬리 끝(가장자리에서 7px)과 핀·말풍선 사이가 6px쯤 비게 한다.
                  top: flipUp ? undefined : gap.below,
                  bottom: flipUp ? gap.above : undefined,
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
                  "pointer-events-none absolute left-1/2 size-[10px] rotate-45 border-gray-200",
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

/** 범례 한 줄 — 색 점(도로 현황은 짧은 선) + 등급. */
function LegendRow({
  levels,
  line = false,
}: {
  levels: { level: string; color: string }[];
  line?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
      {levels.map(({ level, color }) => (
        <span
          key={level}
          className="flex items-center gap-[3px] font-medium text-zinc-700"
        >
          <span
            className={cn(
              "rounded-full",
              line ? "h-[3px] w-[12px]" : "size-[8px]",
            )}
            style={{ background: color }}
          />
          {level}
        </span>
      ))}
    </div>
  );
}

/** 점(경도·위도)이 고리 안에 있는지 — 반직선 교차 세기. */
function inRing(ring: [number, number][], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/**
 * 실시간 인구 장소 범위를 눌렀을 때 — 실시간 인구와, 그 범위 안 지하철역·버스정류장의 하루 승하차 인원.
 * 지도 왼쪽 위(토글 아래)에 띄우고, 닫기·지도 빈 곳·실시간 인구 끄기로 닫는다. 모바일은 아래쪽("목록 보기" 버튼 위).
 */
function CrowdPlaceCard({
  place,
  transit,
  hidden = false,
  onClose,
}: {
  place: CrowdPlace;
  /** 가이드 예시 — 주면 불러오지 않고 이 값을 보여 주고, 모바일은 시트와 똑같이 생긴 보기용 시트로 띄운다. */
  transit?: CrowdTransit;
  /** 가이드 예시 — 자리를 재는 동안 투명하게. */
  hidden?: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  if (!isDesktop)
    return transit ? (
      <CrowdPlaceSheetPreview place={place} transit={transit} hidden={hidden} />
    ) : (
      <CrowdPlaceSheet place={place} onClose={onClose} />
    );
  // PC·태블릿 — 지역명·실시간 인구·닫기는 위에 고정하고, 지하철·버스만 ScrollShadow 안에서 스크롤한다.
  // 유동인구 지도 카드와 같은 유리(반투명 + 흐림) — 지도 위에 뜨는 카드끼리 모양을 맞춘다.
  // 지도 폭이 좁으면(400px 미만, 태블릿) 320px 카드가 오른쪽으로 잘리고 세로로 쌓인 스위치와도 겹쳐서,
  // 지도 폭에 맞춰 아래쪽에 붙인다(범례 위를 덮는다).
  return (
    <Card
      data-tour="crowd-place"
      className={cn(
        "absolute top-(--map-legend-top) left-[12px] z-[2] flex max-h-[calc(100%-var(--map-legend-top)-88px)] w-[320px] @max-[400px]:top-auto @max-[400px]:bottom-[12px] @max-[400px]:w-[calc(100%-24px)] flex-col gap-0 overflow-hidden rounded-[20px] border-[0.5px] border-white/50 bg-surface/75 p-0 shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)] backdrop-blur-[14px] backdrop-saturate-[1.8] transition-opacity duration-300 ease-out motion-reduce:transition-none",
        hidden && "opacity-0",
      )}
    >
      {/* 바깥 여백은 위·아래·양옆 모두 16px로 맞춘다. */}
      <div className="shrink-0 border-b border-zinc-900/5 px-[16px] pt-[16px] pb-[12px]">
        <CrowdPlaceHeader place={place} onClose={onClose} />
      </div>
      <ScrollShadow
        size={24}
        className="flex min-h-0 flex-1 flex-col gap-[14px] px-[16px] pt-[12px] pb-[16px]"
      >
        {transit ? (
          <CrowdTransitSections data={transit} />
        ) : (
          <CrowdPlaceBody code={place.code} />
        )}
      </ScrollShadow>
    </Card>
  );
}

/**
 * 모바일 — 지도 위 작은 카드 대신 아래에서 올라오는 시트(HeroUI Drawer, 손잡이를 끌어내리거나 바깥을 눌러 닫는다).
 * 지역명·실시간 인구·닫기는 위에 고정하고, 지하철·버스만 ScrollShadow 안에서 스크롤한다.
 */
function CrowdPlaceSheet({
  place,
  onClose,
}: {
  place: CrowdPlace;
  onClose: () => void;
}) {
  return (
    <Drawer
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Drawer.Backdrop>
        <Drawer.Content placement="bottom">
          {/* 높이는 내용만큼, 길면 보이는 높이(dvh)의 80%까지 — HeroUI 기본 85vh는 모바일 주소창 때문에 위가 잘린다. */}
          <Drawer.Dialog
            aria-label={`${place.name} 지하철·버스`}
            className="flex max-h-[80dvh] w-full flex-col gap-0 rounded-t-[24px] bg-surface p-0 pt-[10px]"
          >
            <Drawer.Handle />
            <div className="shrink-0 border-b border-tone-f1f1f4 px-[20px] pt-[10px] pb-[14px]">
              <CrowdPlaceHeader place={place} onClose={onClose} large />
            </div>
            <ScrollShadow
              size={32}
              className="flex min-h-0 flex-1 flex-col gap-[16px] px-[20px] pt-[16px] pb-[calc(20px+env(safe-area-inset-bottom))]"
            >
              <CrowdPlaceBody code={place.code} />
            </ScrollShadow>
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </Drawer>
  );
}

/**
 * 가이드 예시(모바일) — 실제 시트(Drawer)는 모달이라 가이드와 포커스·겹침이 부딪혀서, 같은 모양을 화면 아래에
 * 그냥 그린다(누를 수 없음). 지도는 컨테이너 쿼리(@container)라 fixed가 지도 기준이 되므로 body로 띄운다.
 */
function CrowdPlaceSheetPreview({
  place,
  transit,
  hidden,
}: {
  place: CrowdPlace;
  transit: CrowdTransit;
  hidden: boolean;
}) {
  return createPortal(
    <div
      aria-hidden
      data-tour="crowd-place"
      className={cn(
        // 위에 가이드 설명 창이 들어갈 자리(280px)를 남긴다 — 실제 시트처럼 80dvh면 설명 창이 시트를 덮는다.
        "fixed inset-x-0 bottom-0 z-[60] flex max-h-[min(80dvh,calc(100dvh-280px))] flex-col rounded-t-[24px] bg-surface pt-[10px] shadow-[0px_-4px_24px_rgba(0,0,0,0.12)] transition-opacity duration-300 ease-out motion-reduce:transition-none",
        hidden && "opacity-0",
      )}
    >
      <div className="drawer__handle">
        <div data-slot="drawer-handle-bar" />
      </div>
      <div className="shrink-0 border-b border-tone-f1f1f4 px-[20px] pt-[10px] pb-[14px]">
        <CrowdPlaceHeader place={place} onClose={() => {}} large />
      </div>
      <ScrollShadow
        size={32}
        className="flex min-h-0 flex-1 flex-col gap-[16px] px-[20px] pt-[16px] pb-[calc(20px+env(safe-area-inset-bottom))]"
      >
        <CrowdTransitSections data={transit} />
      </ScrollShadow>
    </div>,
    document.body,
  );
}

/** 장소 카드 머리 — 지역명·혼잡도·실시간 인구·닫기. large: 모바일 시트(조금 크게). */
function CrowdPlaceHeader({
  place,
  onClose,
  large = false,
}: {
  place: CrowdPlace;
  onClose: () => void;
  large?: boolean;
}) {
  const color = crowdColor(place.level);
  const range =
    place.populationMin === place.populationMax
      ? `${place.populationMax.toLocaleString()}명`
      : `${place.populationMin.toLocaleString()}~${place.populationMax.toLocaleString()}명`;
  const time = place.measuredAt?.slice(11, 16);
  return (
    <div className="flex items-start justify-between gap-[8px]">
      <div className="flex min-w-0 flex-col gap-[2px]">
        <div className="flex items-center gap-[6px]">
          <span
            className={cn(
              "truncate font-bold text-zinc-900",
              large
                ? "text-[17px] leading-[24px]"
                : "text-[14px] leading-[20px]",
            )}
          >
            {place.name}
          </span>
          <Chip
            size="sm"
            // 혼잡도 색을 꽉 채운 바탕 + 흰 글씨 — 카드가 반투명(유리)이라 옅은 바탕 칩은 뒤 지도 색에 묻힌다.
            // 라이트·다크 같은 모양.
            className={cn(
              "shrink-0 bg-(--crowd) font-bold text-white!",
              large
                ? "h-[20px] px-[7px] text-[11px]"
                : "h-[18px] px-[6px] text-[10px]",
            )}
            style={{ "--crowd": color } as CSSProperties}
          >
            {place.level}
          </Chip>
        </div>
        <span
          className={cn(
            "text-zinc-700 dark:text-[#c9cad3] tabular-nums",
            large ? "text-[13px] leading-[18px]" : "text-[12px] leading-[16px]",
          )}
        >
          실시간 인구 {range}
          {time && (
            <span className="ml-[4px] text-zinc-500 dark:text-[#a4a5af]">
              · {time}
            </span>
          )}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-zinc-600 dark:text-[#b4b5bf] hover:bg-zinc-100",
          large ? "-mr-[6px] size-[32px]" : "-mt-[2px] -mr-[4px] size-[24px]",
        )}
      >
        <XIcon className={large ? "size-[20px]" : "size-[16px]"} />
      </button>
    </div>
  );
}

function CrowdPlaceBody({ code }: { code: string }) {
  const { data, isLoading, isError } = useCrowdTransit(code);
  if (isLoading)
    return (
      <p className="text-[12px] text-zinc-600 dark:text-[#b4b5bf]">
        지하철·버스 승하차를 불러오는 중…
      </p>
    );
  if (isError || !data)
    return (
      <p className="text-[12px] text-zinc-600 dark:text-[#b4b5bf]">
        지하철·버스 승하차를 불러오지 못했어요.
      </p>
    );
  return <CrowdTransitSections data={data} />;
}
