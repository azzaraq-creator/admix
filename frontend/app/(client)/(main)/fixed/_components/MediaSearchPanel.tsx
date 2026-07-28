"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MediaEmptyResults } from "@/components/common/MediaEmptyResults";
import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import {
  mediaApi,
  useFixedClusters,
  useFixedFilterOptions,
  useFixedMediaInfinite,
  type MediaCardRow,
  type MediaFilterParams,
} from "@/hooks/media";

import { MediaSearchFilter } from "@/components/common/mediaFilter/MediaSearchFilter";
import {
  buildFilterUi,
  toChipFilterParams,
  type MediaFilterState,
} from "@/components/common/mediaFilter/filterConfig";

import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { formatFee } from "./chat/format";
import {
  geocodeAddress,
  searchPlaces,
  type KakaoPlace,
  type MapCluster,
  type MapMarker,
} from "./MapArea";

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

// 장소 필터(bbox) — URL의 neLat/swLat/neLng/swLng. 장소 후보 클릭 시에만 설정된다.
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

function isFilterEmpty(f: MediaFilterState): boolean {
  return (
    f.category.length === 0 &&
    f.saleType.length === 0 &&
    f.oohType.length === 0 &&
    f.exposureType.length === 0 &&
    f.mediaShape.length === 0 &&
    f.priceMin == null &&
    f.priceMax == null
  );
}

export function MediaSearchPanel({
  selectedId,
  onSelectMedia,
  onFocusMedia,
  onAddProposal,
  onMapData,
  onRequestMapMove,
}: {
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
  }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sp = new URLSearchParams(searchParams.toString());
  const filter = parseFilter(sp);
  const zoom = parseZoom(sp);
  const bounds = parseBounds(sp);

  const [location, setLocation] = useState("");
  const [placeSug, setPlaceSug] = useState<KakaoPlace[]>([]);
  const [mediaSug, setMediaSug] = useState<MediaCardRow[]>([]);
  const [showSug, setShowSug] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  const { data: opts } = useFixedFilterOptions();
  const { optionsByKey, price } = buildFilterUi(opts);

  const chipFilters: MediaFilterParams = toChipFilterParams(filter);
  const scopedFilters: MediaFilterParams = { ...chipFilters, ...bounds };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFixedMediaInfinite(scopedFilters);
  const rows = (data?.pages ?? []).flatMap((page) => page.items);
  const toItem = (row: MediaCardRow): MediaItemData => ({
    id: row.id,
    name: row.name,
    price: formatFee(row.minAdvertisementFeeKrw),
    images:
      row.images?.length > 0
        ? row.images
        : row.thumbnailUrl
          ? [row.thumbnailUrl]
          : [],
    popular: row.badge === "popular",
  });
  const searchResults: MediaItemData[] = rows.map(toItem);
  const coordsById = new Map(
    rows
      .filter((r) => r.lat != null && r.lng != null)
      .map((r) => [r.id, { lat: r.lat as number, lng: r.lng as number }]),
  );

  // 리스트 클릭 → 그 매체 위치로 줌인. 개별 핀이면 확대 포커싱, 클러스터면 그 위치가 가운데로.
  const FOCUS_ZOOM_LEVEL = 3;
  const handleItemClick = (item: MediaItemData) => {
    onSelectMedia?.(item);
    onFocusMedia?.(item.id);
    const c = coordsById.get(item.id);
    // rescope=false: 리스트(검색 영역)는 고정, 지도만 그 매체로 줌인.
    if (c)
      onRequestMapMove?.({
        lat: c.lat,
        lng: c.lng,
        level: FOCUS_ZOOM_LEVEL,
        rescope: false,
      });
  };

  const { data: clusterData } = useFixedClusters(zoom, scopedFilters);
  useEffect(() => {
    if (!clusterData) return;
    onMapData?.({
      markers: clusterData.markers.map((m) => ({
        id: m.id,
        lat: m.lat,
        lng: m.lng,
        name: m.name,
        categoryLarge: m.categoryLarge,
        minAdvertisementFeeKrw: m.minAdvertisementFeeKrw,
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

  const applyFilter = (next: MediaFilterState) => {
    const q = new URLSearchParams();
    q.set("mode", "search");
    next.category.forEach((v) => q.append("category", v));
    next.saleType.forEach((v) => q.append("saleType", v));
    next.oohType.forEach((v) => q.append("oohType", v));
    next.exposureType.forEach((v) => q.append("exposureType", v));
    next.mediaShape.forEach((v) => q.append("mediaShape", v));
    if (next.priceMin != null) q.set("priceMin", String(next.priceMin));
    if (next.priceMax != null) q.set("priceMax", String(next.priceMax));
    const z = sp.get("zoom");
    if (z != null) q.set("zoom", z);
    // 칩이 남아있으면 장소 스코프(bbox) 유지, 초기화(전부 빔)면 드롭 → 전체 리스트.
    if (!isFilterEmpty(next)) {
      for (const k of ["neLat", "swLat", "neLng", "swLng"]) {
        const v = sp.get(k);
        if (v != null) q.set(k, v);
      }
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  // 통합 자동완성 — 입력 디바운스로 장소(카카오)와 매체명(백엔드)을 병렬 조회.
  useEffect(() => {
    const q = location.trim();
    const timer = setTimeout(async () => {
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
    }, q ? 250 : 0);
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

  // 어떤 좌표 ±반경 bbox로 리스트/지도를 스코프 + 지도 이동(장소 클릭/Enter 공통).
  const scopeToPlace = (lat: number, lng: number, label: string) => {
    setLocation(label);
    setShowSug(false);
    const q = new URLSearchParams(searchParams.toString());
    q.set("mode", "search");
    q.set("neLat", String(lat + PLACE_RADIUS_DEG));
    q.set("swLat", String(lat - PLACE_RADIUS_DEG));
    q.set("neLng", String(lng + PLACE_RADIUS_DEG));
    q.set("swLng", String(lng - PLACE_RADIUS_DEG));
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    onRequestMapMove?.({ lat, lng, level: 5, rescope: true });
  };

  // 장소 후보 → 그 지역으로 스코프 + 이동.
  const selectPlace = (p: KakaoPlace) => scopeToPlace(p.lat, p.lng, p.name);

  // 매체 후보 → 그 매체 1개로 이동 + 선택(리스트 클릭과 동일 동작).
  const selectMediaSug = (row: MediaCardRow) => {
    setLocation(row.name);
    setShowSug(false);
    onSelectMedia?.(toItem(row));
    onFocusMedia?.(row.id);
    if (row.lat != null && row.lng != null) {
      onRequestMapMove?.({
        lat: row.lat,
        lng: row.lng,
        level: FOCUS_ZOOM_LEVEL,
        rescope: false,
      });
    }
  };

  // Enter → 입력 텍스트를 지오코딩(장소/주소)해 그 지역으로 스코프+이동. 매체는 드롭다운 클릭으로만.
  const handleSubmit = async () => {
    const q = location.trim();
    if (!q) return;
    const center = await geocodeAddress(q);
    if (center) scopeToPlace(center.lat, center.lng, q);
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      <div
        ref={searchBoxRef}
        onKeyDown={(e) => {
          if (e.key === "Escape") setShowSug(false);
        }}
        className="relative border-b border-stroke px-[16px] py-[16px]"
      >
        <LocationSearchInput
          value={location}
          onChange={(v) => {
            setLocation(v);
            setShowSug(true);
          }}
          onSubmit={handleSubmit}
          placeholder="매체명 또는 장소로 검색"
          className="w-full"
          autoFocus
        />
        {showSug && (placeSug.length > 0 || mediaSug.length > 0) && (
          <div className="absolute inset-x-[16px] top-[calc(100%-8px)] z-30 max-h-[320px] overflow-y-auto rounded-[8px] border border-stroke bg-white shadow-[0px_4px_16px_rgba(0,0,0,0.12)]">
            {placeSug.length > 0 && (
              <div>
                <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] font-medium text-grey-500">
                  장소
                </div>
                {placeSug.map((p, i) => (
                  <button
                    key={`place-${i}`}
                    type="button"
                    onClick={() => selectPlace(p)}
                    className="flex w-full flex-col items-start gap-[2px] px-[16px] py-[8px] text-left hover:bg-platinum-100"
                  >
                    <span className="text-[14px] text-black">{p.name}</span>
                    {p.address && (
                      <span className="text-[12px] text-grey-500">
                        {p.address}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {mediaSug.length > 0 && (
              <div>
                <div className="px-[16px] pt-[12px] pb-[4px] text-[12px] font-medium text-grey-500">
                  매체
                </div>
                {mediaSug.map((m) => (
                  <button
                    key={`media-${m.id}`}
                    type="button"
                    onClick={() => selectMediaSug(m)}
                    className="flex w-full px-[16px] py-[8px] text-left text-[14px] text-black hover:bg-platinum-100"
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <MediaSearchFilter
        value={filter}
        onChange={applyFilter}
        optionsByKey={optionsByKey}
        price={price}
      />
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {!isLoading && searchResults.length === 0 ? (
          <MediaEmptyResults />
        ) : (
          <div className="flex flex-col">
            {searchResults.map((item) => (
              <MediaItem
                key={item.id}
                {...item}
                selected={item.id === selectedId}
                onClick={() => handleItemClick(item)}
                onAddProposal={() => onAddProposal?.(item.id)}
                className="rounded-none border-0 border-b"
              />
            ))}
            <div ref={sentinelRef} className="h-px w-full" />
          </div>
        )}
      </div>
    </>
  );
}
