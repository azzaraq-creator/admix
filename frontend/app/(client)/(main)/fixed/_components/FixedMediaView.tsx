"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { AddToProposalModal } from "@/components/common/AddToProposalModal";
import { MarkerMediaPopup } from "@/components/common/MarkerMediaPopup";
import {
  MediaDetailDrawer,
  type MediaDetail as DrawerDetail,
} from "@/components/common/MediaDetailDrawer";
import type { MediaItemData } from "@/components/common/MediaItem";
import { MobileMediaDetail } from "@/components/common/MobileMediaDetail";
import { ChevronLeftIcon, MapPinIcon } from "@/components/icons";
import { useMediaDetail } from "@/hooks/media";
import type { Mode } from "../../_components/ModeToggle";
import { ChatPanel } from "./ChatPanel";
import {
  MapArea,
  type MapBoundsPayload,
  type MapCluster,
  type MapMarker,
  type MoveTarget,
} from "./MapArea";
import { SearchHereButton } from "./SearchHereButton";

function toDrawerDetail(
  detail: ReturnType<typeof useMediaDetail>["data"],
): DrawerDetail | undefined {
  if (!detail) return undefined;
  const pop = detail.population;
  return {
    description: detail.description ?? undefined,
    address: detail.address ?? undefined,
    monthlyTraffic: pop ? pop.monthlyFootTraffic.toLocaleString() : undefined,
    mainAudience: pop
      ? [
          {
            gender: pop.malePct >= pop.femalePct ? "남성" : "여성",
            age: pop.ageRatios.reduce((top, cur) =>
              cur.value > top.value ? cur : top,
            ).label,
          },
        ]
      : undefined,
    genderRatio: pop ? { male: pop.malePct, female: pop.femalePct } : undefined,
    ageRatio: pop
      ? pop.ageRatios.map((a) => ({
          label: a.label,
          value: a.value,
          bound: a.bound ?? undefined,
        }))
      : undefined,
  };
}

function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

const DRAWER_HALF_WIDTH = 192;

// 매체검색 모드 기본 진입 위치 — 강남역. URL에 bbox가 없을 때 이 영역으로 스코프.
const DEFAULT_SEARCH_CENTER = { lat: 37.497942, lng: 127.027621, level: 5 };

export function FixedMediaView({
  initialMode = "ai",
}: {
  initialMode?: Mode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // /fixed?mode=search 진입(새로고침 포함) → 항상 기본 위치(강남역)로 스코프.
  // (이전 세션의 URL bbox가 남아 있어도 강남역으로 초기화)
  const scopeDefault = initialMode === "search";
  const [mode, setMode] = useState<Mode>(initialMode);
  const [chatOpen, setChatOpen] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItemData | null>(null);
  const [mobileMap, setMobileMap] = useState(false);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [searchMarkers, setSearchMarkers] = useState<MapMarker[]>([]);
  const [searchClusters, setSearchClusters] = useState<MapCluster[]>([]);
  const [mapMoved, setMapMoved] = useState(false);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(() =>
    scopeDefault ? { ...DEFAULT_SEARCH_CENTER } : null,
  );
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [addProposalMediaId, setAddProposalMediaId] = useState<string | null>(
    null,
  );
  const liveBoundsRef = useRef<MapBoundsPayload | null>(null);
  const pendingAutoCommitRef = useRef(scopeDefault);

  const activeMarkers = mode === "search" ? searchMarkers : markers;

  const commitBounds = useCallback(
    (b: MapBoundsPayload) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("neLat", String(b.neLat));
      q.set("swLat", String(b.swLat));
      q.set("neLng", String(b.neLng));
      q.set("swLng", String(b.swLng));
      q.set("zoom", String(b.zoom));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // 줌만 갱신 — 검색 영역(bbox)은 고정, zoom_level만 바꿔 클러스터를 다시 묶는다.
  const commitZoomOnly = useCallback(
    (zoom: number) => {
      const q = new URLSearchParams(searchParams.toString());
      if (!q.has("neLat")) return; // 검색 영역이 없으면 줌만으로는 조회하지 않음.
      q.set("zoom", String(zoom));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleBoundsChange = useCallback(
    (b: MapBoundsPayload) => {
      liveBoundsRef.current = b;
      if (b.moveType === "program") {
        // 지오코딩/클러스터 클릭 등 프로그램 이동 → 예약된 경우에만 커밋.
        if (pendingAutoCommitRef.current) {
          pendingAutoCommitRef.current = false;
          setMapMoved(false);
          commitBounds(b);
        }
        return;
      }
      if (mode !== "search") return;
      if (b.moveType === "zoom") {
        // 줌은 검색 영역 고정, zoom_level만 갱신 → 클러스터만 재조정(결과 확장 X).
        commitZoomOnly(b.zoom);
      } else if (b.moveType === "drag") {
        // 이동(드래그)은 '현재 위치 검색' 버튼으로 영역 변경.
        setMapMoved(true);
      }
    },
    [commitBounds, commitZoomOnly, mode],
  );

  const handleRequestMapMove = useCallback(
    (center: {
      lat: number;
      lng: number;
      level?: number;
      rescope?: boolean;
    }) => {
      const level = center.level ?? 5;
      setMoveTarget({ lat: center.lat, lng: center.lng, level });
      if (center.rescope === false) {
        // 리스트(검색 영역)는 고정, 줌만 갱신 → 클러스터만 재조정.
        commitZoomOnly(level);
      } else {
        // 재검색(지오코딩): 기존 선택/포커스/팝업 해제 후 그 영역으로 재설정.
        setSelectedMedia(null);
        setFocusId(undefined);
        setPopupId(null);
        pendingAutoCommitRef.current = true;
      }
    },
    [commitZoomOnly],
  );

  const handleSearchHere = useCallback(() => {
    if (!liveBoundsRef.current) return;
    setMapMoved(false);
    commitBounds(liveBoundsRef.current);
  }, [commitBounds]);

  // 클러스터 클릭 → 줌인 후 새 영역으로 자동 재조회(클러스터 분해).
  const handleClusterClick = useCallback(() => {
    pendingAutoCommitRef.current = true;
  }, []);

  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode(next);
      setMapMoved(false);
      if (next === "search") {
        if (liveBoundsRef.current) commitBounds(liveBoundsRef.current);
      } else {
        setSearchMarkers([]);
        setSearchClusters([]);
      }
    },
    [commitBounds],
  );

  const handleMapData = useCallback(
    (data: { markers: MapMarker[]; clusters: MapCluster[] }) => {
      setSearchMarkers(data.markers);
      setSearchClusters(data.clusters);
    },
    [],
  );

  const { data: detail } = useMediaDetail(selectedMedia?.id ?? null);
  const features = detail?.features.map(
    (f) => [f.label, f.value] as [string, string],
  );
  const planList = detail?.plans.map((p) => ({
    title: p.title,
    subtitle: p.subtitle ?? "",
  }));
  const detailImage = detail?.thumbnailUrl ?? detail?.imageUrls[0] ?? null;
  const population = detail?.population
    ? {
        malePct: detail.population.malePct,
        femalePct: detail.population.femalePct,
        ageRatios: detail.population.ageRatios.map((a) => ({
          label: a.label,
          value: a.value,
          bound: a.bound ?? undefined,
        })),
      }
    : null;

  const { data: popupDetail } = useMediaDetail(popupId);
  const popupItems: MediaItemData[] = popupId
    ? [
        {
          id: popupId,
          name:
            activeMarkers.find((m) => m.id === popupId)?.name ??
            popupDetail?.name ??
            "",
          price: formatFee(popupDetail?.minAdvertisementFeeKrw ?? null),
          images: popupDetail?.imageUrls ?? [],
          popular: popupDetail?.badge === "popular",
        },
      ]
    : [];

  const handleMarkerClick = (id: string) => {
    setPopupId(id);
    setFocusId(id);
  };

  // 새 추천 리스트 → 마커 갱신 + 포커스/팝업 해제(전체 범위로)
  const handleRecommendations = useCallback((mk: MapMarker[]) => {
    setMarkers(mk);
    setFocusId(undefined);
    setPopupId(null);
  }, []);

  const handleOpenDetail = (item: MediaItemData) => setSelectedMedia(item);

  const closeDetail = () => {
    setSelectedMedia(null);
    setFocusId(undefined);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <MapArea
        markers={activeMarkers}
        clusters={mode === "search" ? searchClusters : []}
        autoFit={mode !== "search"}
        moveTarget={moveTarget}
        onBoundsChange={handleBoundsChange}
        onClusterClick={handleClusterClick}
        onMarkerClick={handleMarkerClick}
        focusId={focusId}
        focusOffsetX={selectedMedia ? DRAWER_HALF_WIDTH : 0}
        focusCenter={!popupId}
        popupId={popupId}
        popupContent={
          popupId ? (
            <MarkerMediaPopup
              items={popupItems}
              onSelect={(item) => {
                setSelectedMedia(item);
                setPopupId(null);
              }}
              onAddProposal={(item) => setAddProposalMediaId(item.id)}
            />
          ) : null
        }
        onPopupClose={() => setPopupId(null)}
        className={`absolute inset-y-0 right-0 left-0 z-0 transition-[left] duration-300 ease-in-out sm:block ${
          chatOpen ? "sm:left-[384px]" : "sm:left-0"
        } ${mobileMap ? "block" : "hidden"}`}
      />

      {mode === "search" && mapMoved && (
        <div
          className={`pointer-events-none absolute top-[16px] right-0 left-0 z-20 flex justify-center transition-[left] duration-300 ease-in-out ${
            chatOpen ? "sm:left-[384px]" : "sm:left-0"
          } ${mobileMap ? "flex" : "hidden sm:flex"}`}
        >
          <div className="pointer-events-auto">
            <SearchHereButton onClick={handleSearchHere} />
          </div>
        </div>
      )}

      <div
        className={`absolute inset-y-0 left-0 right-0 z-10 sm:right-auto sm:flex ${
          mobileMap ? "hidden" : "flex"
        }`}
      >
        {chatOpen && (
          <ChatPanel
            mode={mode}
            onModeChange={handleModeChange}
            onSelectMedia={setSelectedMedia}
            selectedId={selectedMedia?.id}
            onRecommendations={handleRecommendations}
            onFocusMedia={setFocusId}
            onOpenDetail={handleOpenDetail}
            onAddProposal={(id) => setAddProposalMediaId(id)}
            onMapData={handleMapData}
            onRequestMapMove={handleRequestMapMove}
          />
        )}
        {chatOpen && selectedMedia && (
          <div className="hidden sm:block">
            <MediaDetailDrawer
              media={selectedMedia}
              detail={toDrawerDetail(detail)}
              onClose={closeDetail}
              onViewDetail={() => router.push(`/media/${selectedMedia.id}`)}
            />
          </div>
        )}
        <div className="hidden items-center sm:flex">
          <button
            type="button"
            onClick={() => setChatOpen((open) => !open)}
            aria-label={chatOpen ? "채팅 패널 접기" : "채팅 패널 펼치기"}
            className="flex h-[44px] w-[22px] items-center justify-center rounded-r-[4px] border-y border-r border-stroke bg-white text-black"
          >
            <ChevronLeftIcon
              className={`size-[16px] transition-transform duration-300 ${
                chatOpen ? "" : "rotate-180"
              }`}
            />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMobileMap((value) => !value)}
        className="absolute bottom-[24px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[6px] rounded-full bg-primary px-[16px] py-[8px] text-white drop-shadow-[0px_2px_8px_rgba(0,0,0,0.2)] sm:hidden"
      >
        <MapPinIcon className="size-[18px]" />
        <span className="text-sm font-medium whitespace-nowrap">
          {mobileMap ? "목록보기" : "지도보기"}
        </span>
      </button>

      {selectedMedia && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-white sm:hidden">
          <MobileMediaDetail
            name={selectedMedia.name}
            price={formatFee(detail?.minAdvertisementFeeKrw ?? null)}
            badge={detail?.badge ?? null}
            description={detail?.description ?? undefined}
            features={features}
            mediaList={planList}
            size={detail?.sizeText ?? null}
            imageUrl={detailImage}
            population={population}
            onBack={closeDetail}
          />
        </div>
      )}

      {addProposalMediaId && (
        <AddToProposalModal
          mediaId={addProposalMediaId}
          onClose={() => setAddProposalMediaId(null)}
        />
      )}
    </div>
  );
}
