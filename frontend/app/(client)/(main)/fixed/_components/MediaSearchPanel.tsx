"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import {
  useFixedClusters,
  useFixedFilterOptions,
  useFixedMediaInfinite,
  type MapBounds,
  type MediaFilterParams,
} from "@/hooks/media";

import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { formatFee } from "./chat/format";
import { geocodeAddress, type MapCluster, type MapMarker } from "./MapArea";
import { MediaSearchFilter } from "./search/MediaSearchFilter";
import {
  toOptions,
  type ChipDimKey,
  type FilterOption,
  type FixedFilterState,
} from "./search/filterConfig";

function parseFilter(sp: URLSearchParams): FixedFilterState {
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
  onRequestMapMove?: (center: { lat: number; lng: number }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sp = new URLSearchParams(searchParams.toString());
  const filter = parseFilter(sp);
  const bounds = parseBounds(sp);

  const [location, setLocation] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: opts } = useFixedFilterOptions();
  const optionsByKey: Record<ChipDimKey, FilterOption[]> = {
    category: toOptions("category", opts?.categories ?? []),
    saleType: toOptions("saleType", opts?.product_master_types ?? []),
    oohType: toOptions("oohType", opts?.ooh_types ?? []),
    exposureType: toOptions("exposureType", opts?.exposure_types ?? []),
    mediaShape: toOptions("mediaShape", opts?.media_shapes ?? []),
  };
  const price =
    opts && opts.price_min != null && opts.price_max != null
      ? { min: opts.price_min, max: opts.price_max, histogram: opts.price_histogram }
      : null;

  const chipFilters: MediaFilterParams = {
    category: filter.category,
    oohType: filter.oohType,
    exposureType: filter.exposureType,
    mediaShape: filter.mediaShape,
    productMasterType: filter.saleType,
    priceMin: filter.priceMin,
    priceMax: filter.priceMax,
  };
  const listFilters: MediaFilterParams = {
    ...chipFilters,
    neLat: bounds?.neLat ?? null,
    swLat: bounds?.swLat ?? null,
    neLng: bounds?.neLng ?? null,
    swLng: bounds?.swLng ?? null,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFixedMediaInfinite(listFilters);
  const searchResults: MediaItemData[] = (data?.pages ?? []).flatMap((page) =>
    page.items.map((row) => ({
      id: row.id,
      name: row.name,
      price: formatFee(row.minAdvertisementFeeKrw),
      images: row.thumbnailUrl ? [row.thumbnailUrl] : [],
      popular: row.badge === "popular",
    })),
  );

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
      })),
      clusters: clusterData.clusters.map((c) => ({
        lat: c.lat,
        lng: c.lng,
        count: c.count,
      })),
    });
  }, [clusterData, onMapData]);

  const applyFilter = (next: FixedFilterState) => {
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
    const center = await geocodeAddress(location);
    if (center) onRequestMapMove?.(center);
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
        />
      </div>
      <MediaSearchFilter
        value={filter}
        onChange={applyFilter}
        optionsByKey={optionsByKey}
        price={price}
      />
      <div ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto">
        <div className="flex flex-col">
          {searchResults.map((item) => (
            <MediaItem
              key={item.id}
              {...item}
              selected={item.id === selectedId}
              onClick={() => {
                onSelectMedia?.(item);
                onFocusMedia?.(item.id);
              }}
              onAddProposal={() => onAddProposal?.(item.id)}
              className="rounded-none border-0 border-b"
            />
          ))}
          <div ref={sentinelRef} className="h-px w-full" />
        </div>
      </div>
    </>
  );
}
