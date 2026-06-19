"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaDetailDrawer } from "@/components/common/MediaDetailDrawer";
import type { MediaItemData } from "@/components/common/MediaItem";
import { ChevronLeftIcon, MapPinIcon } from "@/components/icons";
import { ChatPanel } from "./ChatPanel";
import { MapArea } from "./MapArea";

export function FixedMediaView() {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItemData | null>(null);
  const [mobileMap, setMobileMap] = useState(false);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <MapArea
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
            onSelectMedia={setSelectedMedia}
            selectedId={selectedMedia?.id}
          />
        )}
        {chatOpen && selectedMedia && (
          <MediaDetailDrawer
            media={selectedMedia}
            onClose={() => setSelectedMedia(null)}
            onViewDetail={() => router.push(`/media/${selectedMedia.id}`)}
          />
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
    </div>
  );
}
