"use client";

import { useEffect, useRef, useState } from "react";

import { MediaFilterBar } from "@/components/common/MediaFilterBar";
import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import { useFixedMediaInfinite } from "@/hooks/media";

import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { formatFee } from "./chat/format";

export function MediaSearchPanel({
  selectedId,
  onSelectMedia,
  onAddProposal,
}: {
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  const [location, setLocation] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useFixedMediaInfinite();
  const searchResults: MediaItemData[] = (data?.pages ?? []).flatMap((page) =>
    page.items.map((row) => ({
      id: row.id,
      name: row.name,
      price: formatFee(row.minAdvertisementFeeKrw),
      images: row.thumbnailUrl ? [row.thumbnailUrl] : [],
      popular: row.badge === "popular",
    })),
  );

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
      <MediaFilterBar />
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
