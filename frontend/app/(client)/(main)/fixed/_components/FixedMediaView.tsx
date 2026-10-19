"use client";

import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import {
  type AddProposalOptions,
  AddToProposalModal,
} from "@/components/common/AddToProposalModal";
import {
  MediaDetailModal,
  MediaDetailPreview,
} from "@/components/common/MediaDetailModal";
import type { MediaItemData } from "@/components/common/MediaItem";
import {
  type TourStep,
  useActivePageTourStep,
  usePageTour,
  useShownPageTourStep,
} from "@/components/common/PageTour";
import {
  type MediaCardRow,
  type OperatingArea,
  useMediaDetail,
  useMediaCrowd,
  useMediaTraffic,
} from "@/hooks/media";
import { useIsDesktop } from "@/hooks/useIsDesktop";

import {
  MapArea,
  type MapBoundsPayload,
  type MapCluster,
  type MapMarker,
  type MoveTarget,
} from "./MapArea";
import {
  GUIDE_DEMO_DETAIL,
  GUIDE_DEMO_ROW,
  guideDemoPlace,
  guideDemoTransit,
} from "./guideDemo";
import { MarkerMediaPopup } from "./MarkerMediaPopup";
import { MediaFindPanel } from "./MediaFindPanel";
import { replaceQuery } from "./replaceQuery";

/** 지도 마커 → 매체 찾기 카드 행. 팝업을 목록과 같은 카드로 그리기 위한 변환. */
function markerToCardRow(m: MapMarker): MediaCardRow {
  return {
    id: m.id,
    name: m.name,
    minAdvertisementFeeKrw: m.minAdvertisementFeeKrw ?? null,
    minProductionFeeKrw: m.minProductionFeeKrw ?? null,
    address: m.address ?? null,
    categoryLarge: m.categoryLarge ?? null,
    categorySmall: m.categorySmall ?? null,
    salesType: null,
    thumbnailUrl: m.thumbnailUrl ?? null,
    images: m.images ?? [],
    badge: m.badge ?? null,
    lat: m.lat,
    lng: m.lng,
  };
}

/** 카드 행 → 상세 팝업을 여는 데 쓰는 최소 정보. */
function cardRowToItem(row: MediaCardRow): MediaItemData {
  return {
    id: row.id,
    name: row.name,
    price: "",
    images: row.images,
    popular: row.badge === "popular",
  };
}

// 진입 시 지도 기본 위치 — 강남역. 리스트는 스코프하지 않고 지도 시야만 잡는다.
const DEFAULT_CENTER = { lat: 37.497942, lng: 127.027621, level: 4 };

// URL 조회 영역(bbox) — 네 값이 모두 있어야 유효하다.
function parseUrlBounds(sp: URLSearchParams) {
  const nums = (["neLat", "swLat", "neLng", "swLng"] as const).map((k) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : NaN;
  });
  if (nums.some((n) => !Number.isFinite(n))) return null;
  const [neLat, swLat, neLng, swLng] = nums;
  return { neLat, swLat, neLng, swLng };
}

// 두 영역이 사실상 같은지 — 각 변의 차이가 영역 폭·높이의 1% 이내면 같다고 본다.
function isSameArea(
  a: { neLat: number; swLat: number; neLng: number; swLng: number },
  b: { neLat: number; swLat: number; neLng: number; swLng: number },
): boolean {
  const tolLat = Math.abs(a.neLat - a.swLat) * 0.01;
  const tolLng = Math.abs(a.neLng - a.swLng) * 0.01;
  return (
    Math.abs(a.neLat - b.neLat) <= tolLat &&
    Math.abs(a.swLat - b.swLat) <= tolLat &&
    Math.abs(a.neLng - b.neLng) <= tolLng &&
    Math.abs(a.swLng - b.swLng) <= tolLng
  );
}

// URL이 길어지지 않게 좌표는 소수 6자리(약 10cm)까지만 남긴다.
function roundCoord(v: number): string {
  return String(Math.round(v * 1e6) / 1e6);
}

const CROWD_STORAGE_KEY = "admix.map.crowd";
// 실시간 인구를 켰을 때 범위 밖을 흑백으로 — 기본은 켬("0"으로 꺼 둔 경우만 끔).
const CROWD_GRAY_STORAGE_KEY = "admix.map.crowd-gray";
// "실시간 인구"를 보여 주는 가장 넓은 지도 레벨(카카오 — 숫자가 클수록 넓게 본다).
const CROWD_MAX_LEVEL = 7;
const CROWD_EVENT = "admix:crowd-setting";

/** "실시간 인구" 켜 둔 상태 — 이 브라우저(localStorage)에 기억한다. 서버 렌더에서는 꺼짐. */
function useCrowdSetting(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CROWD_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CROWD_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(CROWD_STORAGE_KEY) === "1",
    () => false,
  );
}

function setCrowdSetting(on: boolean) {
  window.localStorage.setItem(CROWD_STORAGE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(CROWD_EVENT));
}

/** "흑백" 켜 둔 상태 — 실시간 인구와 같이 이 브라우저에 기억한다. 기본은 켬. */
function useCrowdGraySetting(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CROWD_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CROWD_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(CROWD_GRAY_STORAGE_KEY) !== "0",
    () => true,
  );
}

function setCrowdGraySetting(on: boolean) {
  window.localStorage.setItem(CROWD_GRAY_STORAGE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(CROWD_EVENT));
}

// "도로 현황"(서울시 실시간 도로 소통 정보) 켜 둔 상태 — 실시간 인구와 같이 이 브라우저에 기억한다. 기본은 끔.
const TRAFFIC_STORAGE_KEY = "admix.map.traffic";

function useTrafficSetting(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CROWD_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CROWD_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => window.localStorage.getItem(TRAFFIC_STORAGE_KEY) === "1",
    () => false,
  );
}

function setTrafficSetting(on: boolean) {
  window.localStorage.setItem(TRAFFIC_STORAGE_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event(CROWD_EVENT));
}

// 매체 찾기 가이드 — 단계 id에 맞춰 예시 카드·지도 장소 카드·매체 정보 창을 띄운다(guideDemo).
// 곡률은 대상 곡률 + 밝힌 자리 여백(6px).
const TOUR_STEPS: TourStep[] = [
  {
    id: "search",
    target: ["find-search", "find-tabs"],
    targetAll: true,
    title: "검색·필터·정렬",
    body: "검색과 필터로 매체를 좁히고, 탭으로 고정·이동 매체를 나눠 봐요.",
    radius: 26,
  },
  {
    id: "map-layers",
    target: "map-layers",
    title: "실시간 인구·흑백·도로 현황",
    body: "장소별 혼잡도와 도로 소통 상태를 지도에서 봐요. 흑백은 붐비는 곳을 돋보이게 해요.",
    radius: 21,
  },
  {
    id: "crowd-place",
    target: "crowd-place",
    title: "지역별 인구·교통",
    body: "색칠된 지역 범위를 누르면 실시간 인구와 지하철·버스 승하차가 보여요.",
    radius: 20,
  },
  {
    id: "card",
    target: "find-card-demo",
    title: "기획안 담기·관심 매체",
    body: "기획안에 바로 담거나, 하트로 관심 매체에 저장해요.",
    radius: 22,
  },
  {
    id: "options",
    target: "detail-options",
    title: "상품·기간·제작 수",
    body: "상품과 개월 수, 제작 개수를 고르면 예상 비용이 바로 나와요.",
    radius: 18,
  },
  {
    id: "info",
    target: "detail-info",
    title: "매체 정보",
    body: "유동인구와 매체 상세 정보를 한눈에 확인해요.",
    mobileBody: "탭을 넘기며 유동인구와 매체 정보를 확인해요.",
    radius: 16,
  },
];

const MAP_STEPS = new Set(["map-layers", "crowd-place"]);
const DETAIL_STEPS = new Set(["options", "info"]);
const noop = () => {};

export function FixedMediaView() {
  const searchParams = useSearchParams();
  const isDesktop = useIsDesktop();

  const [selectedMedia, setSelectedMedia] = useState<MediaItemData | null>(
    null,
  );
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [clusters, setClusters] = useState<MapCluster[]>([]);
  // 진입 시 지도 위치 — URL에 조회 영역(bbox)이 남아 있으면(새로고침·공유 링크) 그 영역의
  // 가운데와 URL 줌 레벨로 그대로 복원한다. 목록이 지도 영역을 따르므로 둘이 어긋나지 않게 한다.
  // (fitBounds로 맞추면 영역이 다 담기는 레벨을 골라 새로고침할 때마다 한 단계씩 멀어진다.)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(() => {
    const b = parseUrlBounds(searchParams);
    const zoom = Number(searchParams.get("zoom"));
    return b
      ? {
          lat: (b.neLat + b.swLat) / 2,
          lng: (b.neLng + b.swLng) / 2,
          level:
            Number.isFinite(zoom) && zoom > 0 ? zoom : DEFAULT_CENTER.level,
        }
      : { ...DEFAULT_CENTER };
  });
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  // 목록에서 마우스를 올린 이동매체의 운행 지역 — 지도에 반투명 영역으로 그린다.
  const [hoverArea, setHoverArea] = useState<OperatingArea | null>(null);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [groupPopup, setGroupPopup] = useState<MapMarker[] | null>(null);
  // 지도 팝업 "간략히 보기" — 핀을 바꿔 눌러도 고른 보기를 유지한다.
  const [popupSimple, setPopupSimple] = useState(false);
  // 매체 담기 대상 — 상세 팝업의 "매체 목록"에서 고른 플랜(planNo)까지 함께 넘긴다.
  const [addProposal, setAddProposal] = useState<{
    mediaId: string;
    planNo?: number;
    options?: AddProposalOptions;
  } | null>(null);
  // 프로그램 이동(코드가 지도를 옮긴 것) 중 목록에 반영할 것을 예약한다.
  // initial=첫 진입, rescope=장소·매체 후보 검색, cluster=클러스터 클릭 줌인. null이면 반영 안 함
  // (리스트 카드 클릭 줌인 등 — 목록은 그대로 두고 지도만 옮긴다).
  const pendingCommitRef = useRef<"initial" | "rescope" | "cluster" | null>(
    "initial",
  );
  // 마지막으로 멈춘 지도 영역 — 초기화 때 "지금 보이는 영역" 조회를 유지하는 데 쓴다.
  const lastViewportRef = useRef<MapBoundsPayload | null>(null);
  // "실시간 인구" — 켜 둔 상태는 이 브라우저에 기억한다. 켰을 때만 서울시 혼잡도를 묻는다.
  const crowdOn = useCrowdSetting();
  const crowdGray = useCrowdGraySetting();
  const trafficOn = useTrafficSetting();
  // 지도 영역은 실시간 인구·교통을 켰을 때만 상태로 둔다 — 꺼 둔 채로 지도를 옮기거나 확대·축소할 때마다
  // 이 화면 전체(목록 카드 포함)가 다시 그려져 태블릿에서 지도가 버벅였다. 줌 단계만은 버튼을 보일지
  // 정하는 데 늘 필요해서 따로 두고, 값이 바뀔 때만 다시 그린다.
  const [crowdBounds, setCrowdBounds] = useState<MapBoundsPayload | null>(null);
  const [mapZoom, setMapZoom] = useState<number | null>(null);
  const toggleCrowd = (on: boolean) => {
    setCrowdSetting(on);
    if (on) setCrowdBounds(lastViewportRef.current);
  };
  const toggleTraffic = (on: boolean) => {
    setTrafficSetting(on);
    if (on) setCrowdBounds(lastViewportRef.current);
  };
  // 넓게 볼 때(레벨 8 이상)는 버튼·표시를 모두 숨기고 서울시에도 묻지 않는다 — 장소가 너무 많아 겹친다.
  const crowdZoomOk = mapZoom != null && mapZoom <= CROWD_MAX_LEVEL;
  const { data: crowdData } = useMediaCrowd(
    crowdBounds,
    crowdOn && crowdZoomOk,
  );
  const { data: trafficData } = useMediaTraffic(
    crowdBounds,
    trafficOn && crowdZoomOk,
  );

  // zoom_level만 URL에 반영 → 전체 매체를 그 줌 그리드로 다시 클러스터링한다.
  const commitZoomOnly = useCallback((zoom: number) => {
    replaceQuery((q) => q.set("zoom", String(zoom)));
  }, []);

  // 지금 보이는 지도 영역을 URL 조회 영역(bbox)으로 반영 → 목록·지도 클러스터가 그 영역으로
  // 다시 조회된다. 장소 칩("OO 주변")은 사용자가 지도를 옮기면 더 이상 맞지 않아 뗀다.
  // 검색해서 고른 매체(pin)는 지도를 옮겨도 목록 맨 위에 그대로 둔다 — 새로 검색하거나 초기화할 때만 지운다.
  const commitViewport = useCallback(
    (b: MapBoundsPayload, keepPlace: boolean) => {
      replaceQuery((q) => {
        q.set("zoom", String(b.zoom));
        q.set("neLat", roundCoord(b.neLat));
        q.set("swLat", roundCoord(b.swLat));
        q.set("neLng", roundCoord(b.neLng));
        q.set("swLng", roundCoord(b.swLng));
        if (!keepPlace) q.delete("place");
      });
    },
    [],
  );

  const handleBoundsChange = useCallback(
    (b: MapBoundsPayload) => {
      lastViewportRef.current = b;
      setMapZoom(b.zoom);
      if (crowdOn || trafficOn) setCrowdBounds(b);
      if (b.moveType === "program") {
        const reason = pendingCommitRef.current;
        if (!reason) return;
        pendingCommitRef.current = null;
        // 홈에서 키워드로 바로 들어온 경우는 전체 결과를 보여줘야 해서 영역을 걸지 않는다.
        if (
          reason === "initial" &&
          searchParams.get("kw") &&
          !parseUrlBounds(searchParams)
        ) {
          commitZoomOnly(b.zoom);
          return;
        }
        // 새로고침·공유 링크로 URL에 영역이 이미 있으면 지도를 그 영역으로 복원한 것이라,
        // 반올림 오차만큼(몇 m) 어긋난 영역을 다시 쓰면 같은 목록을 한 번 더 불러오며 깜빡인다.
        // 차이가 미미하면 URL 영역을 그대로 둔다.
        if (reason === "initial") {
          const urlBounds = parseUrlBounds(searchParams);
          if (urlBounds && isSameArea(urlBounds, b)) return;
        }
        commitViewport(b, reason !== "cluster");
        return;
      }
      // 사용자 드래그·줌 → 지금 보이는 영역으로 목록을 다시 조회하고, 골라 둔 마커·지도 팝업은 해제한다.
      // 목록이 바뀌며 올려 둔 카드가 사라질 수 있어(마우스를 떼는 이벤트가 안 온다) 운행 지역도 지운다.
      setFocusId(undefined);
      setHoverArea(null);
      setPopupId(null);
      setGroupPopup(null);
      commitViewport(b, false);
    },
    [commitZoomOnly, commitViewport, searchParams, crowdOn, trafficOn],
  );

  const handleRequestMapMove = useCallback(
    (center: {
      lat: number;
      lng: number;
      level?: number;
      rescope?: boolean;
      focusId?: string;
      fitBounds?: {
        neLat: number;
        swLat: number;
        neLng: number;
        swLng: number;
      };
    }) => {
      const level = center.level ?? 5;
      setMoveTarget({
        lat: center.lat,
        lng: center.lng,
        level,
        fitBounds: center.fitBounds,
      });
      if (center.rescope === false) {
        // 리스트(검색 영역)는 고정, 줌만 갱신 → 클러스터만 재조정.
        commitZoomOnly(level);
      } else {
        // 재스코프: 열려있던 지도 팝업/그룹은 해제.
        setPopupId(null);
        setGroupPopup(null);
        if (center.focusId) {
          // 매체 후보 클릭: 그 영역으로 리로드 후 해당 핀 포커스(프리뷰는 유지).
          setFocusId(center.focusId);
        } else {
          // 장소 재검색: 기존 선택/포커스 해제.
          setSelectedMedia(null);
          setFocusId(undefined);
        }
        pendingCommitRef.current = "rescope";
      }
    },
    [commitZoomOnly],
  );

  // 클러스터 클릭 → 줌인이 끝나면 그 영역으로 목록·클러스터를 다시 조회.
  const handleClusterClick = useCallback(() => {
    pendingCommitRef.current = "cluster";
  }, []);

  const handleMapData = useCallback(
    (data: { markers: MapMarker[]; clusters: MapCluster[] }) => {
      setMarkers(data.markers);
      setClusters(data.clusters);
    },
    [],
  );

  const { data: popupDetail } = useMediaDetail(
    popupId && !markers.some((m) => m.id === popupId) ? popupId : null,
  );

  // 핀 팝업은 마커 데이터로 그린다. 마커 목록이 새로 고쳐져 해당 핀이 빠진 경우만
  // 상세 API 값으로 채운다.
  const popupMarker = popupId ? markers.find((m) => m.id === popupId) : null;
  const popupRows: MediaCardRow[] = popupMarker
    ? [markerToCardRow(popupMarker)]
    : popupId && popupDetail
      ? [
          {
            id: popupDetail.id,
            name: popupDetail.name,
            minAdvertisementFeeKrw: popupDetail.minAdvertisementFeeKrw,
            minProductionFeeKrw: popupDetail.minProductionFeeKrw,
            address: popupDetail.address,
            categoryLarge: popupDetail.categoryLarge,
            categorySmall: popupDetail.categorySmall,
            salesType: popupDetail.salesType,
            thumbnailUrl: popupDetail.thumbnailUrl,
            images: popupDetail.imageUrls,
            badge: popupDetail.badge,
            lat: null,
            lng: null,
          },
        ]
      : [];

  const groupRows: MediaCardRow[] = (groupPopup ?? []).map(markerToCardRow);
  // 검색해서 고른 매체(URL pin) — 지도 팝업(같은 주소 묶음 포함)에서 하이라이트한다.
  // 지도를 직접 옮기면 pin이 지워져 하이라이트도 사라진다.
  const searchedId = searchParams.get("pin");

  const handleMarkerClick = (id: string) => {
    setGroupPopup(null);
    setPopupId(id);
    setFocusId(id);
  };

  // 겹친 마커(카운트 배지) 클릭 → 그 매체들을 리스트 팝업으로.
  // 개별 핀 포커스는 해제(겹침핀 활성화 시 다른 핀 selected 유지 방지).
  const handleGroupClick = useCallback((mk: MapMarker[]) => {
    setPopupId(null);
    setFocusId(undefined);
    setGroupPopup(mk);
  }, []);

  // 지도 빈 곳 클릭(onPopupClose는 지도 클릭에서만 불린다) → 팝업을 닫고 핀 선택도 푼다.
  // 핀·숫자핀·팝업은 clickable 오버레이라 눌러도 지도 클릭으로 번지지 않는다.
  const closePopup = () => {
    setPopupId(null);
    setGroupPopup(null);
    setFocusId(undefined);
  };

  // 상세 팝업을 닫아도 핀 포커스는 유지한다 — 어느 매체를 보고 있었는지 지도에 남긴다.
  const closeDetail = () => {
    setSelectedMedia(null);
  };

  // 가이드 — 열 때 떠 있던 팝업·창은 닫고, 단계마다 예시 데이터를 띄운다.
  usePageTour("media-find", TOUR_STEPS, {
    onStart: () => {
      setSelectedMedia(null);
      setAddProposal(null);
      closePopup();
    },
  });
  const tourStep = useActivePageTourStep();
  // 예시 화면은 먼저 그려 자리를 재고, 밝힌 자리가 옮겨 갈 때(보이는 단계) 드러낸다.
  const shownStep = useShownPageTourStep();
  const touring = tourStep != null;
  const mapStep = touring && MAP_STEPS.has(tourStep);
  // 예시 장소는 가이드를 열 때 한 번 만든다(기준 시각 = 지금).
  const demoPlace = useMemo(
    () =>
      touring ? { place: guideDemoPlace(), transit: guideDemoTransit() } : null,
    [touring],
  );
  const demoCrowd = demoPlace && {
    // 실시간 인구·흑백은 밝힌 자리가 지도 위 스위치로 옮겨 갈 때 켠다.
    on: shownStep != null && MAP_STEPS.has(shownStep),
    onToggle: noop,
    gray: true,
    onToggleGray: noop,
    places: [demoPlace.place],
    loading: false,
  };
  const demoTraffic = { on: false, onToggle: noop, links: [], loading: false };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-gray-50 px-[20px] pt-[20px] pb-[20px] max-sm:px-[16px] max-sm:pt-[12px] max-sm:pb-[16px]">
      <MediaFindPanel
        // 모바일은 목록·지도를 한 번에 하나만 보여서 지도 단계에선 지도로 바꾼다.
        demo={
          touring
            ? {
                row: GUIDE_DEMO_ROW,
                view: mapStep && !isDesktop ? "map" : "list",
              }
            : null
        }
        selectedId={selectedMedia?.id}
        onSelectMedia={setSelectedMedia}
        onFocusMedia={(id) => {
          // 리스트에서 선택 시 열려있던 지도 팝업/그룹리스트는 닫는다(잔존 방지).
          setPopupId(null);
          setGroupPopup(null);
          setFocusId(id);
        }}
        onAddProposal={(id) => setAddProposal({ mediaId: id })}
        onMapData={handleMapData}
        onRequestMapMove={handleRequestMapMove}
        getViewport={() => lastViewportRef.current}
        onHoverArea={setHoverArea}
        mapSlot={
          <MapArea
            markers={markers}
            clusters={clusters}
            selectedGroup={groupPopup}
            autoFit={false}
            moveTarget={moveTarget}
            onBoundsChange={handleBoundsChange}
            onClusterClick={handleClusterClick}
            onGroupClick={handleGroupClick}
            onMarkerClick={handleMarkerClick}
            focusId={focusId}
            focusCenter={!popupId}
            popupId={popupId}
            popupPosition={
              groupPopup && groupPopup.length > 0
                ? { lat: groupPopup[0].lat, lng: groupPopup[0].lng }
                : null
            }
            popupContent={
              groupPopup ? (
                <MarkerMediaPopup
                  simple={popupSimple}
                  onSimpleChange={setPopupSimple}
                  rows={groupRows}
                  highlightId={searchedId}
                  // 상세 팝업을 닫으면 보던 묶음 목록으로 돌아오도록 목록 팝업은 열어 둔다.
                  onSelect={(row) => setSelectedMedia(cardRowToItem(row))}
                  onAddProposal={(row) => setAddProposal({ mediaId: row.id })}
                />
              ) : popupId ? (
                <MarkerMediaPopup
                  simple={popupSimple}
                  onSimpleChange={setPopupSimple}
                  rows={popupRows}
                  highlightId={searchedId}
                  // 상세 팝업을 닫으면 보던 지도 팝업으로 돌아오도록 지도 팝업은 열어 둔다.
                  onSelect={(row) => setSelectedMedia(cardRowToItem(row))}
                  onAddProposal={(row) => setAddProposal({ mediaId: row.id })}
                />
              ) : null
            }
            onPopupClose={closePopup}
            highlightArea={hoverArea}
            demoPlace={
              tourStep === "crowd-place" && demoPlace
                ? { ...demoPlace, visible: shownStep === "crowd-place" }
                : null
            }
            crowd={
              mapStep && demoCrowd
                ? demoCrowd
                : // 넓게 보거나(레벨 8 이상) 서버에 서울시 키가 없으면(enabled=false) 버튼째 숨긴다.
                  !crowdZoomOk || crowdData?.enabled === false
                  ? undefined
                  : {
                      on: crowdOn,
                      onToggle: toggleCrowd,
                      gray: crowdGray,
                      onToggleGray: setCrowdGraySetting,
                      places: crowdData?.places ?? [],
                      loading: !crowdData || crowdData.pending > 0,
                    }
            }
            traffic={
              mapStep
                ? demoTraffic
                : // 실시간 인구와 같은 서울시 주요 장소 기준이라, 넓게 보거나 키가 없으면 같이 숨긴다.
                  !crowdZoomOk || trafficData?.enabled === false
                  ? undefined
                  : {
                      on: trafficOn,
                      onToggle: toggleTraffic,
                      links: trafficData?.links ?? [],
                      // 이미 그린 구간이 있으면 다시 받는 중이어도 "불러오는 중"이라 하지 않는다.
                      loading:
                        !trafficData ||
                        (trafficData.pending > 0 &&
                          trafficData.links.length === 0),
                    }
            }
            className="size-full"
          />
        }
      />

      {touring && DETAIL_STEPS.has(tourStep) && (
        <MediaDetailPreview
          vm={GUIDE_DEMO_DETAIL}
          visible={shownStep != null && DETAIL_STEPS.has(shownStep)}
        />
      )}

      {selectedMedia && (
        <MediaDetailModal
          mediaId={selectedMedia.id}
          onClose={closeDetail}
          // 상세 팝업은 연 채로, 담기 모달을 그 위에 띄운다.
          onAddProposal={(id, planNo, options) =>
            setAddProposal({ mediaId: id, planNo, options })
          }
        />
      )}

      {addProposal && (
        <AddToProposalModal
          mediaId={addProposal.mediaId}
          planNo={addProposal.planNo}
          options={addProposal.options}
          onClose={() => setAddProposal(null)}
        />
      )}
    </div>
  );
}
