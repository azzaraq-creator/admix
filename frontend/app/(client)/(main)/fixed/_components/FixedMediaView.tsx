"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MediaDetailDrawer } from "@/components/common/MediaDetailDrawer";
import type { MediaItemData } from "@/components/common/MediaItem";
import { ChevronLeftIcon } from "@/components/icons";
import { Sidebar } from "../../_components/Sidebar";
import { ChatPanel } from "./ChatPanel";
import { MapArea } from "./MapArea";

export function FixedMediaView() {
  const router = useRouter();
  const [chatOpen, setChatOpen] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<MediaItemData | null>(null);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-white">
      <MapArea
        className={`absolute inset-y-0 right-0 z-0 transition-[left] duration-300 ease-in-out ${
          chatOpen ? "left-[448px]" : "left-[64px]"
        }`}
      />

      <div className="absolute inset-y-0 left-0 z-10 flex">
        <Sidebar />
        {chatOpen && <ChatPanel onSelectMedia={setSelectedMedia} />}
        {chatOpen && selectedMedia && (
          <MediaDetailDrawer
            media={selectedMedia}
            onClose={() => setSelectedMedia(null)}
            onViewDetail={() => router.push(`/media/${selectedMedia.id}`)}
          />
        )}
        <div className="flex items-center">
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
    </div>
  );
}
