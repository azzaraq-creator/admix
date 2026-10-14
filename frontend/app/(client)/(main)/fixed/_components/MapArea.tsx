"use client";

import { Card, Chip, Drawer, ScrollShadow, Switch } from "@heroui/react";
import { type CSSProperties, type ReactNode, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  useCrowdTransit,
  type CrowdPlace,
  type OperatingArea,
  type TrafficLink,
} from "@/hooks/media";
import { XIcon } from "@/components/icons";
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
import { CROWD_LEVELS, crowdBg, crowdColor, useMapCrowd } from "./useMapCrowd";
import { useMapMarkers } from "./useMapMarkers";
import { useMapPopup } from "./useMapPopup";
import { TRAFFIC_LEVELS, useMapTraffic } from "./useMapTraffic";

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
  highlightArea,
  crowd,
  traffic,
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

  useMapTraffic({
    mapRef,
    mapReady,
    links: traffic?.on ? traffic.links : null,
  });

  // 실시간 인구 장소 이름표를 눌러 고른 장소 — 끄면 닫는다. 내용은 늘 최근에 받은 값으로.
  const [pickedPlace, setPickedPlace] = useState<CrowdPlace | null>(null);
  const picked =
    crowd?.on && pickedPlace
      ? (crowd.places.find((p) => p.code === pickedPlace.code) ?? pickedPlace)
      : null;

  const {
    hovered: crowdHovered,
    hoverEl: crowdHoverEl,
    boardShown: crowdBoardShown,
  } = useMapCrowd({
    mapRef,
    mapReady,
    places: crowd?.on ? crowd.places : null,
    gray: !!crowd?.gray,
    selectedCode: picked?.code,
    onSelect: setPickedPlace,
  });

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
    <div className={cn("relative", className)}>
      {/* 모바일은 지도가 좁아 실시간 인구 토글·범례(z-[2])가 매체 정보 팝업을 가린다 —
          팝업(지도 안에 그려진다)이 열려 있는 동안은 지도째 그 위로 올린다. */}
      <div
        ref={containerRef}
        className={cn(
          "h-full w-full bg-[#e9edf0]",
          (popupId || popupPosition) && "max-sm:relative max-sm:z-[3]",
          // 실시간 인구를 켜면 범위 밖은 흑백 판(useMapCrowd)이 덮는다. 판이 아직 없거나 확대·축소 중엔
          // 판이 어긋나므로 지도 전체를 흑백으로(globals.css) — 색이 번쩍 돌아오지 않게.
          crowd?.on && crowd.gray && !crowdBoardShown && "map-crowd-gray",
        )}
      />
      {crowdHovered && crowdHoverEl
        ? createPortal(<CrowdHoverCard place={crowdHovered} />, crowdHoverEl)
        : null}
      {(crowd || traffic) && (
        // 스위치형 — [아이콘 · 실시간 인구 · 스위치 | 흑백 | 도로 현황]. 켜면 스위치만 서비스 색(보라)으로 바뀐다
        // (혼잡도 "붐빔" 빨강과 헷갈리지 않게). 바탕은 반투명 유리(뒤 지도가 흐리게 비친다).
        <div className="absolute top-[12px] left-[12px] z-[2] flex h-[30px] items-center rounded-full border-[0.5px] border-white/40 bg-white/40 pr-[8px] pl-[10px] shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px] backdrop-saturate-[1.8]">
          {crowd && (
            <Switch
              size="sm"
              isSelected={crowd.on}
              onChange={crowd.onToggle}
              aria-label="실시간 인구 보기"
              className="[--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
            >
              <Switch.Content className="gap-[6px] text-[12px] font-semibold text-[#18181b]">
                {/* 아이콘 모양은 public/icons/group.svg */}
                <span
                  aria-hidden
                  className="h-[11px] w-[12px] shrink-0 bg-current [mask:url(/icons/group.svg)_center/contain_no-repeat]"
                />
                <span>
                  실시간 인구
                  {/* 서울시 데이터라 서울만 보인다는 걸 알린다. */}
                  <span className="ml-[3px] font-medium text-[#71717a]">
                    (서울)
                  </span>
                </span>
                <Switch.Control className="ml-[2px]">
                  {/* 켜져도 손잡이는 흰색(테마 기본은 진한 색이라 보라 위에서 안 보인다). */}
                  <Switch.Thumb className="bg-white!" />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
          {crowd?.on && (
            <>
              {/* 실시간 인구를 켰을 때만 — 범위 밖을 흑백으로 할지. */}
              <span
                aria-hidden
                className="mx-[8px] h-[14px] w-px bg-[#18181b]/15"
              />
              <Switch
                size="sm"
                isSelected={crowd.gray}
                onChange={crowd.onToggleGray}
                aria-label="범위 밖 흑백으로 보기"
                className="[--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
              >
                <Switch.Content className="gap-[6px] text-[12px] font-semibold text-[#18181b]">
                  <span>흑백</span>
                  <Switch.Control>
                    <Switch.Thumb className="bg-white!" />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            </>
          )}
          {crowd && traffic && (
            <span
              aria-hidden
              className="mx-[8px] h-[14px] w-px bg-[#18181b]/15"
            />
          )}
          {traffic && (
            // 도로 현황 — 서울시 도로 구간을 속도로 정한 소통 등급 색(원활·서행·정체) 선으로.
            <Switch
              size="sm"
              isSelected={traffic.on}
              onChange={traffic.onToggle}
              aria-label="도로 현황 보기"
              className="[--switch-control-bg-checked:var(--color-primary)] [--switch-control-bg-checked-hover:var(--color-primary-600)]"
            >
              <Switch.Content className="gap-[6px] text-[12px] font-semibold text-[#18181b]">
                <span>도로 현황</span>
                <Switch.Control>
                  <Switch.Thumb className="bg-white!" />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        </div>
      )}
      {(crowd?.on || traffic?.on) && (
        // 범례 — 실시간 인구 혼잡도 4단계·도로 현황 3단계. 장소 표시에 마우스를 올리면 인구·기준 시각이 보인다.
        // 모바일은 아래쪽에 "목록 보기" 버튼이 떠 있어 토글 버튼 바로 밑에 둔다.
        <div className="absolute bottom-[12px] left-[12px] z-[2] flex flex-col gap-[4px] rounded-[12px] border-[0.5px] border-white/40 bg-white/40 px-[10px] py-[8px] text-[11px] shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px] backdrop-saturate-[1.8] max-sm:top-[50px] max-sm:bottom-auto max-sm:max-w-[calc(100%-24px)]">
          {crowd?.on && (
            <>
              <LegendRow levels={CROWD_LEVELS} />
              <span className="text-[10px] text-gray-500">
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
              <span className="text-[10px] text-gray-500">
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
      {picked && (
        <CrowdPlaceCard place={picked} onClose={() => setPickedPlace(null)} />
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

/**
 * 실시간 인구 장소에 마우스를 올렸을 때 뜨는 작은 카드 — 지도에는 그 장소 범위가 함께 칠해진다.
 * 검정 반투명 — 흰 유리 스타일의 장소 표시와 겹쳐 보이지 않게 구분한다.
 */
function CrowdHoverCard({ place }: { place: CrowdPlace }) {
  const color = crowdColor(place.level);
  const range =
    place.populationMin === place.populationMax
      ? `${place.populationMax.toLocaleString()}명`
      : `${place.populationMin.toLocaleString()}~${place.populationMax.toLocaleString()}명`;
  const time = place.measuredAt?.slice(11, 16);
  return (
    <Card className="w-max gap-[2px] rounded-[10px] border-0 bg-black/60 px-[10px] py-[6px] shadow-[0px_3px_10px_rgba(0,0,0,0.2)] backdrop-blur-[6px]">
      <div className="flex items-center gap-[6px] whitespace-nowrap">
        <span className="text-[12px] leading-[16px] font-bold text-white">
          {place.name}
        </span>
        <Chip
          size="sm"
          className="h-[16px] px-[5px] text-[10px] font-bold"
          // 어두운 바탕 위라 혼잡도 색 글자에 옅은 흰 바탕을 깐다.
          style={{ color, background: "rgba(255,255,255,0.92)" }}
        >
          {place.level}
        </Chip>
      </div>
      <span className="text-[11px] leading-[15px] whitespace-nowrap text-white/90 tabular-nums">
        {range}
        {time && <span className="ml-[4px] text-white/60">· {time}</span>}
      </span>
    </Card>
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
          className="flex items-center gap-[3px] font-medium text-[#3f3f46]"
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

/**
 * 실시간 인구 장소 이름표를 눌렀을 때 — 실시간 인구와, 그 범위 안 지하철역·버스정류장의 하루 승하차 인원.
 * 지도 왼쪽 위(토글 아래)에 띄우고, 닫기·지도 빈 곳·실시간 인구 끄기로 닫는다. 모바일은 아래쪽("목록 보기" 버튼 위).
 */
function CrowdPlaceCard({
  place,
  onClose,
}: {
  place: CrowdPlace;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  if (!isDesktop) return <CrowdPlaceSheet place={place} onClose={onClose} />;
  // PC·태블릿 — 지역명·실시간 인구·닫기는 위에 고정하고, 지하철·버스만 ScrollShadow 안에서 스크롤한다.
  return (
    <Card className="absolute top-[52px] left-[12px] z-[2] flex max-h-[calc(100%-140px)] w-[320px] flex-col gap-0 overflow-hidden rounded-[14px] border-0 bg-white p-0 shadow-[0px_4px_16px_rgba(0,0,0,0.18)]">
      <div className="shrink-0 border-b border-[#f1f1f4] px-[14px] pt-[12px] pb-[10px]">
        <CrowdPlaceHeader place={place} onClose={onClose} />
      </div>
      <ScrollShadow
        size={24}
        className="flex min-h-0 flex-1 flex-col gap-[14px] px-[14px] pt-[12px] pb-[12px]"
      >
        <CrowdPlaceBody code={place.code} />
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
            className="flex max-h-[80dvh] w-full flex-col gap-0 rounded-t-[24px] bg-white p-0 pt-[10px]"
          >
            <Drawer.Handle />
            <div className="shrink-0 border-b border-[#f1f1f4] px-[20px] pt-[10px] pb-[14px]">
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
              "truncate font-bold text-[#18181b]",
              large
                ? "text-[17px] leading-[24px]"
                : "text-[14px] leading-[20px]",
            )}
          >
            {place.name}
          </span>
          <Chip
            size="sm"
            className={cn(
              "shrink-0 font-bold",
              large
                ? "h-[20px] px-[7px] text-[11px]"
                : "h-[18px] px-[6px] text-[10px]",
            )}
            style={{ color, background: crowdBg(place.level) }}
          >
            {place.level}
          </Chip>
        </div>
        <span
          className={cn(
            "text-[#52525b] tabular-nums",
            large ? "text-[13px] leading-[18px]" : "text-[12px] leading-[16px]",
          )}
        >
          실시간 인구 {range}
          {time && <span className="ml-[4px] text-[#a1a1aa]">· {time}</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full text-[#71717a] hover:bg-[#f4f4f5]",
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
      <p className="text-[12px] text-[#71717a]">
        지하철·버스 승하차를 불러오는 중…
      </p>
    );
  if (isError || !data)
    return (
      <p className="text-[12px] text-[#71717a]">
        지하철·버스 승하차를 불러오지 못했어요.
      </p>
    );
  return <CrowdTransitSections data={data} />;
}
