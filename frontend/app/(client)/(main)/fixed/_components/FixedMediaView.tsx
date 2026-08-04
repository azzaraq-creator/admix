"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { AddToProposalModal } from "@/components/common/AddToProposalModal";
import { MarkerMediaPopup } from "@/components/common/MarkerMediaPopup";
import { MediaDetailDrawer } from "@/components/common/MediaDetailDrawer";
import {
  formatFee,
  useMediaDetailViewModel,
} from "@/components/common/media-detail/useMediaDetailViewModel";
import type { MediaItemData } from "@/components/common/MediaItem";
import { MobileMediaDetail } from "@/components/common/MobileMediaDetail";
import { ChevronLeftIcon, ListIcon, MapPinIcon } from "@/components/icons";
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
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(() =>
    scopeDefault ? { ...DEFAULT_SEARCH_CENTER } : null,
  );
  const [focusId, setFocusId] = useState<string | undefined>(undefined);
  const [popupId, setPopupId] = useState<string | null>(null);
  const [groupPopup, setGroupPopup] = useState<MapMarker[] | null>(null);
  const [addProposalMediaId, setAddProposalMediaId] = useState<string | null>(
    null,
  );
  const pendingAutoCommitRef = useRef(scopeDefault);

  const activeMarkers = mode === "search" ? searchMarkers : markers;

  // zoom_level만 URL에 반영 → 전체 매체를 그 줌 그리드로 다시 클러스터링한다.
  const commitZoomOnly = useCallback(
    (zoom: number) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("zoom", String(zoom));
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const handleBoundsChange = useCallback(
    (b: MapBoundsPayload) => {
      if (b.moveType === "program") {
        // 지오코딩/클러스터 클릭 등 프로그램 이동 → 예약된 경우에만 줌 커밋.
        if (pendingAutoCommitRef.current) {
          pendingAutoCommitRef.current = false;
          commitZoomOnly(b.zoom);
        }
        return;
      }
      if (mode !== "search") return;
      // 줌 변경 → zoom_level 갱신으로 클러스터 재조정. 드래그는 결과와 무관하므로 무동작.
      if (b.moveType === "zoom") {
        commitZoomOnly(b.zoom);
      }
    },
    [commitZoomOnly, mode],
  );

  const handleRequestMapMove = useCallback(
    (center: {
      lat: number;
      lng: number;
      level?: number;
      rescope?: boolean;
      focusId?: string;
    }) => {
      const level = center.level ?? 5;
      setMoveTarget({ lat: center.lat, lng: center.lng, level });
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
        pendingAutoCommitRef.current = true;
      }
    },
    [commitZoomOnly],
  );

  // 클러스터 클릭 → 줌인 후 새 줌으로 자동 재클러스터링.
  const handleClusterClick = useCallback(() => {
    pendingAutoCommitRef.current = true;
  }, []);

  const handleModeChange = useCallback(
    (next: Mode) => {
      setMode(next);
      if (next === "search") {
        // 홈 /fixed?mode=search 진입과 동일하게: URL 통일 + 강남역 스코프.
        router.replace(`${pathname}?mode=search`, { scroll: false });
        setMoveTarget({ ...DEFAULT_SEARCH_CENTER });
        pendingAutoCommitRef.current = true;
      } else {
        router.replace(pathname, { scroll: false });
        setMobileMap(false);
        setSearchMarkers([]);
        setSearchClusters([]);
      }
    },
    [router, pathname],
  );

  const handleMapData = useCallback(
    (data: { markers: MapMarker[]; clusters: MapCluster[] }) => {
      setSearchMarkers(data.markers);
      setSearchClusters(data.clusters);
    },
    [],
  );

  const { vm } = useMediaDetailViewModel(selectedMedia?.id ?? null);

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

  const groupItems: MediaItemData[] = (groupPopup ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    price: formatFee(m.minAdvertisementFeeKrw ?? null),
    images:
      m.images && m.images.length > 0
        ? m.images
        : m.thumbnailUrl
          ? [m.thumbnailUrl]
          : [],
    popular: m.badge === "popular",
  }));

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

  const closePopup = () => {
    setPopupId(null);
    setGroupPopup(null);
  };

  // 새 추천 리스트 → 마커 갱신 + 포커스/팝업 해제(전체 범위로)
  const handleRecommendations = useCallback((mk: MapMarker[]) => {
    setMarkers(mk);
    setFocusId(undefined);
    setPopupId(null);
  }, []);

  // "새 대화" → AI 추천 마커/활성 핀/팝업/상세를 모두 초기화.
  const handleNewSession = useCallback(() => {
    setMarkers([]);
    setFocusId(undefined);
    setPopupId(null);
    setGroupPopup(null);
    setSelectedMedia(null);
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
        selectedGroup={groupPopup}
        autoFit={mode !== "search"}
        moveTarget={moveTarget}
        onBoundsChange={handleBoundsChange}
        onClusterClick={handleClusterClick}
        onGroupClick={handleGroupClick}
        onMarkerClick={handleMarkerClick}
        focusId={focusId}
        focusOffsetX={selectedMedia ? DRAWER_HALF_WIDTH : 0}
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
              items={groupItems}
              onSelect={(item) => {
                setSelectedMedia(item);
                setFocusId(item.id);
                setGroupPopup(null);
              }}
              onAddProposal={(item) => setAddProposalMediaId(item.id)}
            />
          ) : popupId ? (
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
        onPopupClose={closePopup}
        className={`absolute inset-y-0 right-0 left-0 z-0 transition-[left] duration-300 ease-in-out sm:block ${
          chatOpen ? "sm:left-[384px]" : "sm:left-0"
        } ${mobileMap ? "block" : "hidden"}`}
      />

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
            onFocusMedia={(id) => {
              // 챗에서 선택 시 열려있던 지도 팝업/그룹리스트는 닫는다(잔존 방지).
              setPopupId(null);
              setGroupPopup(null);
              setFocusId(id);
            }}
            onOpenDetail={handleOpenDetail}
            onAddProposal={(id) => setAddProposalMediaId(id)}
            onMapData={handleMapData}
            onRequestMapMove={handleRequestMapMove}
            onNewSession={handleNewSession}
          />
        )}
        {chatOpen && selectedMedia && (
          <div className="hidden sm:block">
            <MediaDetailDrawer
              media={selectedMedia}
              detail={
                vm
                  ? {
                      images: vm.images,
                      description: vm.description,
                      address: vm.address,
                      monthlyTraffic: vm.population?.monthlyTrafficText,
                      mainAudience: vm.population?.mainAudience,
                      genderRatio: vm.population?.genderRatio,
                      ageRatio: vm.population?.ageRatios,
                    }
                  : undefined
              }
              onClose={closeDetail}
              onAddProposal={() => setAddProposalMediaId(selectedMedia.id)}
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

      {mode === "search" && (
        <button
          type="button"
          onClick={() => setMobileMap((value) => !value)}
          className="absolute bottom-[24px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-[6px] rounded-full bg-primary px-[16px] py-[8px] text-white drop-shadow-[0px_2px_8px_rgba(0,0,0,0.2)] sm:hidden"
        >
          {mobileMap ? (
            <ListIcon className="size-[18px]" />
          ) : (
            <MapPinIcon className="size-[18px]" />
          )}
          <span className="text-sm font-medium whitespace-nowrap">
            {mobileMap ? "목록보기" : "지도보기"}
          </span>
        </button>
      )}

      {selectedMedia && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-white sm:hidden">
          <MobileMediaDetail
            name={selectedMedia.name}
            price={vm?.price ?? formatFee(null)}
            badge={vm?.badge ?? null}
            description={vm?.description}
            features={vm?.features}
            mediaList={vm?.plans}
            size={vm?.sizeText ?? null}
            imageUrl={vm?.imageUrl ?? null}
            population={
              vm?.population
                ? {
                    monthlyFootTraffic: vm.population.monthlyFootTraffic,
                    malePct: vm.population.malePct,
                    femalePct: vm.population.femalePct,
                    ageRatios: vm.population.ageRatios,
                  }
                : null
            }
            onAddProposal={() => setAddProposalMediaId(selectedMedia.id)}
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
