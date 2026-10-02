"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import {
  type AddProposalOptions,
  AddToProposalModal,
} from "@/components/common/AddToProposalModal";
import { MediaDetailModal } from "@/components/common/MediaDetailModal";
import type { MediaItemData } from "@/components/common/MediaItem";
import { useMediaDetail, type MediaCardRow } from "@/hooks/media";

import {
  MapArea,
  type MapBoundsPayload,
  type MapCluster,
  type MapMarker,
  type MoveTarget,
} from "./MapArea";
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
const DEFAULT_CENTER = { lat: 37.497942, lng: 127.027621, level: 5 };

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

export function FixedMediaView() {
  const searchParams = useSearchParams();

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
      setFocusId(undefined);
      setPopupId(null);
      setGroupPopup(null);
      commitViewport(b, false);
    },
    [commitZoomOnly, commitViewport, searchParams],
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

  const closeDetail = () => {
    setSelectedMedia(null);
    setFocusId(undefined);
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-black-50 px-[20px] pt-[20px] pb-[20px] max-sm:px-[16px] max-sm:pt-[12px] max-sm:pb-[16px]">
      <MediaFindPanel
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
                  onSelect={(row) => {
                    setSelectedMedia(cardRowToItem(row));
                    setFocusId(row.id);
                    setGroupPopup(null);
                  }}
                  onAddProposal={(row) => setAddProposal({ mediaId: row.id })}
                />
              ) : popupId ? (
                <MarkerMediaPopup
                  simple={popupSimple}
                  onSimpleChange={setPopupSimple}
                  rows={popupRows}
                  highlightId={searchedId}
                  onSelect={(row) => {
                    setSelectedMedia(cardRowToItem(row));
                    setPopupId(null);
                  }}
                  onAddProposal={(row) => setAddProposal({ mediaId: row.id })}
                />
              ) : null
            }
            onPopupClose={closePopup}
            className="size-full"
          />
        }
      />

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
