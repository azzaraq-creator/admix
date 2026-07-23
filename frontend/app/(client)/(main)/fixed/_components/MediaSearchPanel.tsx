"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MediaEmptyResults } from "@/components/common/MediaEmptyResults";
import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import {
  useFixedClusters,
  useFixedFilterOptions,
  useFixedMediaInfinite,
  type MapBounds,
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
import { geocodeAddress, type MapCluster, type MapMarker } from "./MapArea";

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

function parseBounds(sp: URLSearchParams): MapBounds | null {
  const num = (k: string) => {
    const v = sp.get(k);
    return v != null && v !== "" ? Number(v) : null;
  };
  const neLat = num("neLat");
  const swLat = num("swLat");
  const neLng = num("neLng");
  const swLng = num("swLng");
  const zoom = num("zoom");
  if (neLat == null || swLat == null || neLng == null || swLng == null) {
    return null;
  }
  return { neLat, swLat, neLng, swLng, zoom: zoom ?? 5 };
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
  const bounds = parseBounds(sp);

  const [location, setLocation] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: opts } = useFixedFilterOptions();
  const { optionsByKey, price } = buildFilterUi(opts);

  const chipFilters: MediaFilterParams = toChipFilterParams(filter);
  const listFilters: MediaFilterParams = {
    ...chipFilters,
    neLat: bounds?.neLat ?? null,
    swLat: bounds?.swLat ?? null,
    neLng: bounds?.neLng ?? null,
    swLng: bounds?.swLng ?? null,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFixedMediaInfinite(listFilters);
  const rows = (data?.pages ?? []).flatMap((page) => page.items);
  const searchResults: MediaItemData[] = rows.map((row) => ({
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
  }));
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

  const { data: clusterData } = useFixedClusters(bounds, chipFilters);
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
    // 현재 지도 영역(bbox)은 필터 변경 시에도 유지.
    for (const k of ["neLat", "swLat", "neLng", "swLng", "zoom"]) {
      const v = sp.get(k);
      if (v != null) q.set(k, v);
    }
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = async () => {
    if (!location.trim()) {
      setSearchNotFound(false);
      return;
    }
    const center = await geocodeAddress(location);
    if (center) {
      setSearchNotFound(false);
      onRequestMapMove?.(center);
    } else {
      setSearchNotFound(true);
    }
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
      <div className="border-b border-stroke px-[16px] py-[16px]">
        <LocationSearchInput
          value={location}
          onChange={setLocation}
          onSubmit={handleSearchSubmit}
          className="w-full"
          autoFocus
        />
      </div>
      <MediaSearchFilter
        value={filter}
        onChange={applyFilter}
        optionsByKey={optionsByKey}
        price={price}
      />
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        {searchNotFound || (!isLoading && searchResults.length === 0) ? (
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
