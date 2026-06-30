"use client";

import { Suspense } from "react";

import type { MediaItemData } from "@/components/common/MediaItem";

import { ModeToggle, type Mode } from "../../_components/ModeToggle";
import { AiChatPanel } from "./AiChatPanel";
import type { MapCluster, MapMarker } from "./MapArea";
import { MediaSearchPanel } from "./MediaSearchPanel";

export function ChatPanel({
  mode,
  onModeChange,
  onSelectMedia,
  selectedId,
  onRecommendations,
  onFocusMedia,
  onOpenDetail,
  onAddProposal,
  onMapData,
  onRequestMapMove,
}: {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  onSelectMedia?: (item: MediaItemData) => void;
  selectedId?: string;
  onRecommendations?: (markers: MapMarker[]) => void;
  onFocusMedia?: (mediaId: string) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
  onMapData?: (data: { markers: MapMarker[]; clusters: MapCluster[] }) => void;
  onRequestMapMove?: (center: {
    lat: number;
    lng: number;
    level?: number;
    rescope?: boolean;
  }) => void;
}) {
  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-[#e8e8e8] bg-white sm:w-[384px]">
      <div className="flex flex-col gap-[16px] border-b border-stroke px-[16px] py-[24px]">
        <ModeToggle className="w-full" value={mode} onChange={onModeChange} />
      </div>

      {mode === "ai" ? (
        <AiChatPanel
          selectedId={selectedId}
          onSelectMedia={onSelectMedia}
          onRecommendations={onRecommendations}
          onFocusMedia={onFocusMedia}
          onOpenDetail={onOpenDetail}
          onAddProposal={onAddProposal}
        />
      ) : (
        <Suspense fallback={null}>
          <MediaSearchPanel
            selectedId={selectedId}
            onSelectMedia={onSelectMedia}
            onFocusMedia={onFocusMedia}
            onAddProposal={onAddProposal}
            onMapData={onMapData}
            onRequestMapMove={onRequestMapMove}
          />
        </Suspense>
      )}
    </div>
  );
}
