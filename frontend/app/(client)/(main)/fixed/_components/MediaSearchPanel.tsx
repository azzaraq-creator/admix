"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import {
  useFixedFilterOptions,
  useFixedMediaInfinite,
  type MediaFilterParams,
} from "@/hooks/media";

import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { formatFee } from "./chat/format";
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

export function MediaSearchPanel({
  selectedId,
  onSelectMedia,
  onAddProposal,
}: {
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = parseFilter(new URLSearchParams(searchParams.toString()));

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

  const filterParams: MediaFilterParams = {
    category: filter.category,
    oohType: filter.oohType,
    exposureType: filter.exposureType,
    mediaShape: filter.mediaShape,
    productMasterType: filter.saleType,
    priceMin: filter.priceMin,
    priceMax: filter.priceMax,
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFixedMediaInfinite(filterParams);
  const searchResults: MediaItemData[] = (data?.pages ?? []).flatMap((page) =>
    page.items.map((row) => ({
      id: row.id,
      name: row.name,
      price: formatFee(row.minAdvertisementFeeKrw),
      images: row.thumbnailUrl ? [row.thumbnailUrl] : [],
      popular: row.badge === "popular",
    })),
  );

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
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
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
              onClick={() => onSelectMedia?.(item)}
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
