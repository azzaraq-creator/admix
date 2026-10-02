"use client";

import { Chip, ScrollShadow } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MediaEmptyResults } from "@/components/common/MediaEmptyResults";
import type { MediaItemData } from "@/components/common/MediaItem";
import {
  buildFilterUi,
  toChipFilterParams,
  type ChipDimKey,
  type MediaFilterState,
} from "@/components/common/mediaFilter/filterConfig";
import { CloseSmallIcon, ListIcon, MapOutlineIcon } from "@/components/icons";
import {
  mediaApi,
  useFixedClusters,
  useFixedFilterOptions,
  useFixedMediaInfinite,
  type MediaCardRow,
  type MediaFilterParams,
} from "@/hooks/media";

import { MediaFilterPanel } from "./MediaFilterPanel";
import { replaceQuery } from "./replaceQuery";
import { MediaFindCard, MediaFindCardSkeleton } from "./MediaFindCard";
import { MediaFindTopBar } from "./MediaFindTopBar";
import {
  DEFAULT_MEDIA_SORT,
  MediaSortBar,
  type MediaSortKey,
  mediaSortLabel,
} from "./MediaSortBar";
import {
  searchPlaces,
  type KakaoPlace,
  type MapCluster,
  type MapMarker,
} from "./MapArea";

/** 필터 칩으로 보여 주는 차원 — 관심 매체 페이지도 같은 칩 줄을 쓴다. */
export const CHIP_DIMS: ChipDimKey[] = [
  "category",
  "saleType",
  "oohType",
  "exposureType",
  "mediaShape",
];

const BBOX_KEYS = ["neLat", "swLat", "neLng", "swLng"] as const;

function parseFilter(sp: URLSearchParams): MediaFilterState {
  const num = (k: string) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : null;
  };
  return {
    category: sp.getAll("category"),
    saleType: sp.getAll("saleType"),
    oohType: sp.getAll("oohType"),
    exposureType: sp.getAll("exposureType"),
    mediaShape: sp.getAll("mediaShape"),
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
  };
}

function parseZoom(sp: URLSearchParams): number {
  const v = sp.get("zoom");
  return v != null && v !== "" ? Number(v) : 5;
}

// 조회 영역(bbox) — URL의 neLat/swLat/neLng/swLng. 지도를 옮기면 지금 보이는 영역으로,
// 장소 후보를 고르면 그 주변으로 설정된다(키워드 Enter 검색 때만 비운다).
function parseBounds(
  sp: URLSearchParams,
): Pick<MediaFilterParams, "neLat" | "swLat" | "neLng" | "swLng"> {
  const num = (k: string) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : null;
  };
  return {
    neLat: num("neLat"),
    swLat: num("swLat"),
    neLng: num("neLng"),
    swLng: num("swLng"),
  };
}

// 장소 클릭 시 그 좌표 ±반경(도)으로 리스트/지도를 스코프.
const PLACE_RADIUS_DEG = 0.02;
// 매체 후보 클릭 포커스 — 그 좌표 ±반경(도, 장소보다 좁게)으로 스코프.
const MEDIA_FOCUS_RADIUS_DEG = 0.005;
// 백엔드는 zoom_level<=1에서만 클러스터를 분해(개별 핀). 매체 포커스는 이 레벨로
// 고정해야 대상이 클러스터 버블에 흡수되지 않고 개별 핀으로 떠 하이라이트된다.
const MEDIA_FOCUS_ZOOM_LEVEL = 1;
// 리스트 클릭 → 그 매체 위치로 줌인할 때 쓰는 레벨.
const FOCUS_ZOOM_LEVEL = 3;
// 첫 진입에서 목록 조회가 이만큼 멈춰 있으면 자리를 잡은 것으로 보고 스켈레톤을 걷는다.
const ENTRY_SETTLE_MS = 300;

export function countFilters(f: MediaFilterState): number {
  return (
    CHIP_DIMS.reduce((sum, key) => sum + f[key].length, 0) +
    (f.priceMin != null || f.priceMax != null ? 1 : 0)
  );
}

export function FilterChip({
  label,
  onRemove,
}: {
  label: ReactNode;
  onRemove: () => void;
}) {
  // 시안 비율 기준(칩 높이 31px): 글자 12px, X 12px, 간격 7px, 좌우 11px, 모서리 11px.
  // HeroUI Chip 기본값(회색 배경·20px 행간·font-medium)은 여기서 덮어쓴다.
  return (
    <Chip className="flex shrink-0 items-center gap-[7px] rounded-[11px] border border-[#ececef] bg-white px-[11px] py-[6px] text-[12px] max-sm:text-[11px] leading-[17px] font-normal text-[#71717a]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label="필터 제거"
        className="cursor-pointer transition-colors hover:text-black-900"
      >
        <CloseSmallIcon className="size-[12px]" />
      </button>
    </Chip>
  );
}

export function MediaFindPanel({
  mapSlot,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  onAddProposal,
  onMapData,
  onRequestMapMove,
  getViewport,
}: {
  /** 지도 영역 — 데이터는 onMapData로 올려보내고 엘리먼트는 부모가 내려준다. */
  mapSlot: ReactNode;
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  onAddProposal?: (mediaId: string) => void;
  onMapData?: (data: { markers: MapMarker[]; clusters: MapCluster[] }) => void;
  onRequestMapMove?: (center: {
    lat: number;
    lng: number;
    level?: number;
    rescope?: boolean;
    focusId?: string;
    fitBounds?: { neLat: number; swLat: number; neLng: number; swLng: number };
  }) => void;
  /** 지금 보이는 지도 영역 — 초기화해도 목록이 지도 영역을 계속 따르게 한다. */
  getViewport?: () => {
    neLat: number;
    swLat: number;
    neLng: number;
    swLng: number;
  } | null;
}) {
  const searchParams = useSearchParams();
  const sp = new URLSearchParams(searchParams.toString());
  const filter = parseFilter(sp);
  const zoom = parseZoom(sp);
  const bounds = parseBounds(sp);
  // Enter 검색어(매체명/주소 부분일치). 설정되면 bbox와 상호배제(백엔드가 AND로 걸기 때문).
  const keyword = sp.get("kw");
  // 장소 스코프 칩에 보여줄 이름. bbox와 함께 세팅된다.
  const placeLabel = sp.get("place");
  // 자동완성에서 고른 매체 — 목록 맨 위에 하이라이트해 고정한다. 장소 칩과 함께 세팅되고,
  // 지도를 직접 옮기거나 다른 검색을 하면 함께 풀린다.
  const pinId = sp.get("pin");

  const [location, setLocation] = useState(() => keyword ?? "");
  const [placeSug, setPlaceSug] = useState<KakaoPlace[]>([]);
  const [mediaSug, setMediaSug] = useState<MediaCardRow[]>([]);
  // 고른 매체의 카드 정보 — 고정 영역이 넓어 목록 첫 페이지에 없을 수도 있어 따로 들고 있는다.
  const [pinnedRow, setPinnedRow] = useState<MediaCardRow | null>(null);
  const [showSug, setShowSug] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_MEDIA_SORT);
  const [mapExpanded, setMapExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  // Enter 키워드 검색 직후, 새 클러스터 결과가 도착하면 그 결과로 지도를 fit하도록 예약.
  const pendingFitRef = useRef(false);

  // 검색어·장소 스코프·필터 칩 중 하나라도 걸려 있으면 "검색한 상태"로 본다.
  // 초기화 버튼과 결과 문구가 같은 기준을 쓴다.
  const filterCount = countFilters(filter);
  const searched = Boolean(keyword || placeLabel) || filterCount > 0;

  const { data: opts } = useFixedFilterOptions();
  const { optionsByKey, price } = buildFilterUi(opts);

  const chipFilters: MediaFilterParams = toChipFilterParams(filter);
  const scopedFilters: MediaFilterParams = {
    ...chipFilters,
    ...bounds,
    keyword,
  };

  // 조회 범위가 정해지기 전(첫 진입에서 지도가 아직 영역을 알려 주지 않았을 때)에는 조회하지 않는다.
  // 그대로 조회하면 범위 없는 전체 매체가 잠깐 떴다가 지도 영역 매체로 바뀐다. 검색어로 들어온
  // 경우는 영역 없이 전체에서 찾는 게 맞으므로 바로 조회한다.
  const scopeReady =
    Boolean(keyword) || BBOX_KEYS.every((k) => bounds[k] != null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetching: listFetching,
    isPending: listPending,
  } = useFixedMediaInfinite({ ...scopedFilters, sort }, scopeReady);

  // 첫 진입 — 지도가 자리를 잡으며 조회 영역이 한 번 더 바뀌면, 먼저 받은 목록이 보였다가 다른
  // 목록으로 바뀌며 깜빡인다. 목록이 도착한 뒤에도 조회가 잠시(ENTRY_SETTLE_MS) 멈출 때까지는
  // 스켈레톤을 유지하고, 그 뒤로는 기존대로 새 목록이 올 때까지 이전 목록을 그대로 둔다.
  const [entrySettled, setEntrySettled] = useState(false);
  const entryWaiting = !scopeReady || listPending || listFetching;
  useEffect(() => {
    if (entrySettled || entryWaiting) return;
    const timer = setTimeout(() => setEntrySettled(true), ENTRY_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [entrySettled, entryWaiting]);

  // 범위를 기다리는 동안도, 첫 결과를 받는 동안도 "불러오는 중"으로 본다.
  const isLoading = !scopeReady || listPending || !entrySettled;
  const rows = (data?.pages ?? []).flatMap((page) => page.items);
  const total = data?.pages[0]?.total ?? 0;
  // 새로고침으로 들고 있던 카드 정보가 없으면 목록에서 찾는다(고른 매체 주변이라 대개 첫 페이지에 있다).
  const foundPinned = pinId ? rows.find((r) => r.id === pinId) : undefined;
  // 목록에서 한 번 찾으면 기억해 둔다 — 지도를 옮겨 그 매체가 영역 밖으로 나가도 맨 위에 남게.
  if (foundPinned && pinnedRow?.id !== pinId) setPinnedRow(foundPinned);
  const pinned = pinId
    ? pinnedRow?.id === pinId
      ? pinnedRow
      : (foundPinned ?? null)
    : null;
  const listRows = pinned ? rows.filter((r) => r.id !== pinned.id) : rows;
  const coordsById = new Map(
    rows
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => [r.id, { lat: r.lat as number, lng: r.lng as number }]),
  );

  /** URL 파라미터를 고쳐 다시 조회한다. 이 화면의 모든 상태는 URL이 원본이다. */
  const commit = replaceQuery;

  const handleItemClick = (row: MediaCardRow) => {
    const item: MediaItemData = {
      id: row.id,
      name: row.name,
      price: "",
      images: row.images,
      popular: row.badge === "popular",
    };
    onSelectMedia?.(item);
    onFocusMedia?.(row.id);
    const c = coordsById.get(row.id);
    // rescope=false: 리스트(검색 영역)는 고정, 지도만 그 매체로 줌인.
    if (c)
      onRequestMapMove?.({
        lat: c.lat,
        lng: c.lng,
        level: FOCUS_ZOOM_LEVEL,
        rescope: false,
      });
  };

  const { data: clusterData } = useFixedClusters(
    zoom,
    scopedFilters,
    scopeReady,
  );
  useEffect(() => {
    if (!clusterData) return;
    onMapData?.({
      markers: clusterData.markers.map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        name: m.name,
        categoryLarge: m.categoryLarge,
        categorySmall: m.categorySmall,
        address: m.address,
        minAdvertisementFeeKrw: m.minAdvertisementFeeKrw,
        minProductionFeeKrw: m.minProductionFeeKrw,
        thumbnailUrl: m.thumbnailUrl,
        images: m.images,
        badge: m.badge,
      })),
      clusters: clusterData.clusters.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        count: c.count,
      })),
    });
  }, [clusterData, onMapData]);

  // 키워드 검색 결과가 도착하면 그 결과(마커+클러스터) 영역에 맞춰 지도를 이동/fit.
  // useFixedClusters가 keepPreviousData를 쓰지 않아 키 전환 시 clusterData가 undefined가
  // 되는 순서에 의존한다(그래서 stale 결과로 잘못 fit하지 않음). keepPreviousData 추가 금지.
  useEffect(() => {
    if (!pendingFitRef.current || !clusterData) return;
    const pts = [
      ...clusterData.markers.map((m) => ({ lat: m.lat, lng: m.lng })),
      ...clusterData.clusters.map((c) => ({ lat: c.lat, lng: c.lng })),
    ];
    pendingFitRef.current = false; // 결과 유무와 무관하게 무장 해제(0건이어도)
    if (pts.length === 0) return; // 결과 없음 → 이동하지 않음(빈 상태 유지)
    const lats = pts.map((p) => p.lat);
    const lngs = pts.map((p) => p.lng);
    const neLat = Math.max(...lats);
    const swLat = Math.min(...lats);
    const neLng = Math.max(...lngs);
    const swLng = Math.min(...lngs);
    const cLat = (neLat + swLat) / 2;
    const cLng = (neLng + swLng) / 2;
    if (pts.length === 1) {
      // 단일 결과 → 미세 bounds 과확대 방지, 중심+레벨로 이동.
      onRequestMapMove?.({ lat: cLat, lng: cLng, level: 5, rescope: true });
    } else {
      onRequestMapMove?.({
        lat: cLat,
        lng: cLng,
        rescope: true,
        fitBounds: { neLat, swLat, neLng, swLng },
      });
    }
  }, [clusterData, onRequestMapMove]);

  const applyFilter = (next: MediaFilterState) =>
    commit((q) => {
      for (const key of CHIP_DIMS) {
        q.delete(key);
        next[key].forEach((v) => q.append(key, v));
      }
      if (next.priceMin != null) q.set("priceMin", String(next.priceMin));
      else q.delete("priceMin");
      if (next.priceMax != null) q.set("priceMax", String(next.priceMax));
      else q.delete("priceMax");
    });

  // 초기화 — 칩·키워드·장소 칩을 비우고 검색 입력도 지운다. 목록은 지도 영역을 따르므로
  // 줌과 지금 보이는 지도 영역(bbox)은 유지한다. 필터 패널 안의 초기화는 패널을 열어 둔다.
  const resetSearch = () => {
    setLocation("");
    setShowSug(false);
    const view = getViewport?.();
    replaceQuery((q) => {
      // 줌과 지금 보이는 영역만 남기고 모두 비운다.
      const z = q.get("zoom");
      for (const k of [...q.keys()]) q.delete(k);
      if (z != null) q.set("zoom", z);
      if (view) {
        for (const k of BBOX_KEYS)
          q.set(k, String(Math.round(view[k] * 1e6) / 1e6));
      }
    });
  };
  const handleReset = () => {
    setFilterOpen(false);
    resetSearch();
  };

  // 통합 자동완성 — 입력 디바운스로 장소(카카오)와 매체명(백엔드)을 병렬 조회.
  useEffect(() => {
    const q = location.trim();
    const timer = setTimeout(
      async () => {
        if (!q) {
          setPlaceSug([]);
          setMediaSug([]);
          return;
        }
        const [places, media] = await Promise.all([
          searchPlaces(q, 5),
          mediaApi.fixedList(5, 0, { keyword: q }),
        ]);
        setPlaceSug(places);
        setMediaSug(media.items);
      },
      q ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [location]);

  // 드롭다운 바깥 클릭 시 닫기.
  useEffect(() => {
    if (!showSug) return;
    const onDown = (e: MouseEvent) => {
      if (!searchBoxRef.current?.contains(e.target as Node)) setShowSug(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [showSug]);

  // 어떤 좌표 ±반경 bbox로 리스트/지도를 스코프 + 지도 이동.
  // focusId 있으면(매체 후보 클릭) 그 매체를 로드 후 포커스, 없으면(장소) 지역 이동만.
  const scopeToPlace = (
    lat: number,
    lng: number,
    label: string,
    focusId?: string,
  ) => {
    setLocation(label);
    setShowSug(false);
    const radius = focusId ? MEDIA_FOCUS_RADIUS_DEG : PLACE_RADIUS_DEG;
    commit((q) => {
      q.delete("kw"); // bbox 스코프는 키워드 검색과 상호배제
      q.set("place", label);
      if (focusId) q.set("pin", focusId);
      else q.delete("pin");
      q.set("neLat", String(lat + radius));
      q.set("swLat", String(lat - radius));
      q.set("neLng", String(lng + radius));
      q.set("swLng", String(lng - radius));
      // 매체 포커스는 디클러스터 레벨을 URL에 즉시 반영 → 클러스터 쿼리가 바로 개별 핀 반환
      // (비동기 auto-commit에 의존하면 기존 zoom으로 조회돼 클러스터에 묻힘).
      if (focusId) q.set("zoom", String(MEDIA_FOCUS_ZOOM_LEVEL));
    });
    onRequestMapMove?.({
      lat,
      lng,
      level: focusId ? MEDIA_FOCUS_ZOOM_LEVEL : 5,
      rescope: true,
      focusId,
    });
  };

  const selectPlace = (p: KakaoPlace) => scopeToPlace(p.lat, p.lng, p.name);

  // 매체 후보 → 상세를 바로 열지 않고, 그 매체를 목록 맨 위에 고정한 채 주변 매체를 보여 준다.
  const selectMediaSug = (row: MediaCardRow) => {
    setPinnedRow(row);
    // 모바일은 지도만 보고 있을 수 있어 목록으로 돌리고, 고른 매체가 보이게 맨 위로 올린다.
    setMapExpanded(false);
    scrollRef.current?.scrollTo({ top: 0 });
    if (row.lat != null && row.lng != null) {
      scopeToPlace(row.lat, row.lng, row.name, row.id);
    } else {
      // 좌표가 없으면 지도 영역은 그대로 두고 고정만 한다.
      setLocation(row.name);
      setShowSug(false);
      commit((q) => q.set("pin", row.id));
      onFocusMedia?.(row.id);
    }
  };

  // Enter → 입력 텍스트가 포함된 매체(매체명/주소)를 리스트·지도에 표시. bbox는 해제.
  // 검색어만 지운다(필터는 그대로) — 검색창 X, 또는 빈 칸에서 Enter.
  // 검색어 검색은 지도 영역(bbox)을 떼므로, 지금 보이는 지도 영역을 다시 걸어 목록이 그 영역을 따르게 한다.
  // (영역도 검색어도 없으면 조회할 범위가 없어 스켈레톤만 계속 보였다.)
  const clearKeyword = () => {
    setLocation("");
    setShowSug(false);
    const view = getViewport?.();
    commit((params) => {
      params.delete("kw");
      params.delete("place");
      params.delete("pin");
      if (view) {
        for (const k of BBOX_KEYS)
          params.set(k, String(Math.round(view[k] * 1e6) / 1e6));
      }
    });
  };

  const handleSubmit = () => {
    const q = location.trim();
    if (!q) {
      clearKeyword();
      return;
    }
    const prev = sp.get("kw");
    // 키워드가 실제로 바뀔 때만(=refetch가 일어날 때만) fit 예약. 같은 키워드 재입력은
    // URL 무변화 → 결과 무변화라 예약해두면 flag가 고아로 남아 엉뚱한 refit을 유발한다.
    if (q && q !== prev) pendingFitRef.current = true;
    setShowSug(false);
    commit((params) => {
      if (q) params.set("kw", q);
      else params.delete("kw");
      params.delete("place");
      params.delete("pin");
      for (const k of BBOX_KEYS) params.delete(k);
    });
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const labelOf = (key: ChipDimKey, value: string) =>
    optionsByKey[key].find((o) => o.value === value)?.label ?? value;

  const removeFilterValue = (key: ChipDimKey, value: string) =>
    applyFilter({ ...filter, [key]: filter[key].filter((v) => v !== value) });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[10px]">
      <div className="relative z-30 shrink-0">
        <MediaFindTopBar
          keyword={location}
          onKeywordChange={(v) => {
            setLocation(v);
            setShowSug(true);
          }}
          onKeywordSubmit={handleSubmit}
          onKeywordClear={clearKeyword}
          searchBoxRef={searchBoxRef}
          filterCount={filterCount}
          filterOpen={filterOpen}
          onToggleFilter={() => {
            setSortOpen(false);
            setFilterOpen((v) => !v);
          }}
          sortLabel={mediaSortLabel(sort)}
          sortOpen={sortOpen}
          onToggleSort={() => {
            setFilterOpen(false);
            setSortOpen((v) => !v);
          }}
          onReset={handleReset}
          resetDisabled={!searched}
          mapExpanded={mapExpanded}
          onToggleMapExpanded={() => setMapExpanded((v) => !v)}
          suggestionSlot={
            showSug && (placeSug.length > 0 || mediaSug.length > 0) ? (
              // 검색 추천 — 테두리·그림자는 바깥 칸에 두고, 안쪽 ScrollShadow가 스크롤하며 넘치는 쪽을 흐리게 한다.
              <div className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[16px] border border-black-200 bg-white shadow-[0px_4px_16px_rgba(0,0,0,0.12)]">
                <ScrollShadow size={24} className="max-h-[318px]">
                  {mediaSug.length > 0 && (
                    <div>
                      <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] max-sm:text-[11px] font-medium text-black-500">
                        매체
                      </div>
                      {mediaSug.map((m) => (
                        <button
                          key={`media-${m.id}`}
                          type="button"
                          onClick={() => selectMediaSug(m)}
                          className="flex w-full px-[16px] py-[8px] text-left text-[14px] max-sm:text-[13px] text-black hover:bg-black-100"
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  {placeSug.length > 0 && (
                    <div>
                      <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] max-sm:text-[11px] font-medium text-black-500">
                        장소
                      </div>
                      {placeSug.map((p, i) => (
                        <button
                          key={`place-${i}`}
                          type="button"
                          onClick={() => selectPlace(p)}
                          className="flex w-full flex-col items-start gap-[2px] px-[16px] py-[8px] text-left hover:bg-black-100"
                        >
                          <span className="text-[14px] max-sm:text-[13px] text-black">
                            {p.name}
                          </span>
                          {p.address && (
                            <span className="text-[12px] max-sm:text-[11px] text-black-500">
                              {p.address}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollShadow>
              </div>
            ) : null
          }
        />

        {sortOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+10px)] z-30">
            <MediaSortBar
              value={sort}
              onChange={(next) => {
                setSort(next);
                setSortOpen(false);
                // 순서가 바뀌면 처음부터 보이게 목록을 맨 위로 올린다.
                scrollRef.current?.scrollTo({ top: 0 });
              }}
            />
          </div>
        )}

        {filterOpen && (
          <div className="absolute inset-x-0 top-[calc(100%+10px)] z-30">
            <MediaFilterPanel
              value={filter}
              optionsByKey={optionsByKey}
              price={price}
              totalCount={total}
              scope={{ ...bounds, keyword }}
              onApply={applyFilter}
              onReset={resetSearch}
              onClose={() => setFilterOpen(false)}
            />
          </div>
        )}
      </div>

      {/* 아래 리스트가 카드 그림자 자리를 만드느라 -mt-[30px]로 이 줄 위까지 박스를
          끌어올린다. 그대로 두면 나중에 그려지는 리스트가 칩을 덮어 X가 눌리지 않으므로
          칩 줄을 z-20으로 띄운다(필터 패널 z-30보다는 아래). */}
      <div className="relative z-20 flex shrink-0 items-center justify-between gap-[12px]">
        <div className="flex min-w-0 flex-wrap items-center gap-[8px]">
          {/* 검색어·장소 스코프는 검색창이 이미 보여주므로 칩으로 내보내지 않는다.
              이 줄에는 "적용된 필터"만 남긴다. */}
          {CHIP_DIMS.flatMap((key) =>
            filter[key].map((value) => (
              <FilterChip
                key={`${key}-${value}`}
                label={labelOf(key, value)}
                onRemove={() => removeFilterValue(key, value)}
              />
            )),
          )}
          {(filter.priceMin != null || filter.priceMax != null) && (
            <FilterChip
              label="가격 범위"
              onRemove={() =>
                applyFilter({ ...filter, priceMin: null, priceMax: null })
              }
            />
          )}
        </div>

        <p className="shrink-0 text-[12px] max-sm:text-[11px] text-black-500">
          {searched ? "검색 결과" : "전체"}{" "}
          <span className="font-semibold text-[#18181b]">
            {isLoading ? "불러오는 중…" : `${total.toLocaleString()}개 매체`}
          </span>
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 gap-[20px]">
        {!mapExpanded && (
          // 목록이 위아래로 더 있으면 가장자리를 흐리게(HeroUI ScrollShadow) 한다.
          <ScrollShadow
            ref={scrollRef}
            hideScrollBar
            size={32}
            // 카드 hover 그림자가 이 스크롤 컨테이너에 잘려서, 좌우는 패딩으로 자리를
            // 만들고 같은 크기의 음수 마진으로 되돌린다(카드 폭·지도와의 간격은 그대로).
            // 위아래는 같은 방법을 쓰면 그만큼 스크롤 영역이 넓어져 카드가 지도 위/아래로
            // 넘어오므로, 지도와 높이를 맞추기 위해 그림자가 잘리는 쪽을 택했다.
            // 모바일은 화면 여백이 16px이라 같은 값으로 맞추고, 아래에 뜨는 지도 전환 버튼이
            // 마지막 카드를 가리지 않게 아래 여백을 둔다.
            // Chrome은 흐림을 스크롤 연동 애니메이션으로 그리는데, 끝까지 내린 뒤 목록이 짧아져
            // 스크롤이 사라지면 위쪽 흐림 값이 그대로 남는다. HeroUI가 함께 달아 주는
            // data-top-scroll·data-bottom-scroll이 둘 다 false(넘칠 게 없음)면 흐림을 끈다.
            className="-mx-[20px] flex w-[calc(100%+40px)] data-[top-scroll=false]:data-[bottom-scroll=false]:[mask-image:none] shrink-0 flex-col gap-[10px] px-[20px] max-sm:-mx-[16px] max-sm:w-[calc(100%+32px)] max-sm:px-[16px] max-sm:pb-[64px] sm:w-[460px]"
          >
            {pinned && (
              <MediaFindCard
                key={`pin-${pinned.id}`}
                row={pinned}
                highlighted
                selected={pinned.id === selectedId}
                onClick={() => handleItemClick(pinned)}
                onAddProposal={() => onAddProposal?.(pinned.id)}
              />
            )}
            {isLoading ? (
              // 첫 결과를 받기 전엔 카드 자리에 스켈레톤을 깔아 로딩 중임을 보여 준다.
              Array.from({ length: 3 }, (_, i) => (
                <MediaFindCardSkeleton key={i} />
              ))
            ) : listRows.length === 0 ? (
              // 고른 매체만 있고 주변 매체가 없으면 빈 안내는 띄우지 않는다.
              pinned ? null : (
                // 목록은 지도 영역을 따르므로, 걸린 조건이 없으면 지도를 옮겨 보라고 안내한다.
                <MediaEmptyResults
                  description={
                    searched
                      ? "검색어나 필터를 바꾸거나, 지도를 옮겨 다시 찾아보세요."
                      : "지도를 옮기거나 축소해 다른 지역을 찾아보세요."
                  }
                  onReset={searched ? handleReset : undefined}
                />
              )
            ) : (
              <>
                {listRows.map((row) => (
                  <MediaFindCard
                    key={row.id}
                    row={row}
                    selected={row.id === selectedId}
                    onClick={() => handleItemClick(row)}
                    onAddProposal={() => onAddProposal?.(row.id)}
                  />
                ))}
                {/* 무한스크롤 감지용 1px 줄. 목록 마지막에 gap 10px + 1px만큼
                    공간을 차지해 끝까지 내렸을 때 마지막 카드가 지도 바닥보다
                    11px 떠 보여서, 그만큼 끌어올려 차지하는 높이를 0으로 만든다. */}
                <div
                  ref={sentinelRef}
                  className="-mt-[11px] h-px w-full shrink-0"
                />
              </>
            )}
          </ScrollShadow>
        )}

        <div
          className={`min-w-0 flex-1 overflow-hidden rounded-[20px] border border-[#eee] ${
            mapExpanded ? "block" : "hidden sm:block"
          }`}
        >
          {mapSlot}
        </div>

        {/* 모바일은 목록과 지도를 한 화면씩 보여 주므로, 아래 가운데에 전환 버튼을 띄운다. */}
        <button
          type="button"
          onClick={() => setMapExpanded((v) => !v)}
          className="absolute bottom-[16px] left-1/2 z-20 flex h-[40px] -translate-x-1/2 items-center gap-[6px] rounded-[17px] bg-black-800 px-[18px] text-[13px] max-sm:text-[12px] font-medium whitespace-nowrap text-white shadow-[0px_4px_12px_rgba(0,0,0,0.2)] transition-colors active:bg-black-900 sm:hidden"
        >
          {mapExpanded ? (
            <ListIcon className="size-[18px] shrink-0" />
          ) : (
            <MapOutlineIcon className="size-[18px] shrink-0" />
          )}
          {mapExpanded ? "목록 보기" : "지도 보기"}
        </button>
      </div>
    </div>
  );
}
