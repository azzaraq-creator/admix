"use client";

import { useState } from "react";

import type { MediaItemData } from "@/components/common/MediaItem";

import { ModeToggle, type Mode } from "../../_components/ModeToggle";
import { AiChatPanel } from "./AiChatPanel";
import type { MapMarker } from "./MapArea";
import { MediaSearchPanel } from "./MediaSearchPanel";

export function ChatPanel({
  initialMode = "ai",
  onSelectMedia,
  selectedId,
  onRecommendations,
  onFocusMedia,
  onOpenDetail,
  onAddProposal,
}: {
  initialMode?: Mode;
  onSelectMedia?: (item: MediaItemData) => void;
  selectedId?: string;
  onRecommendations?: (markers: MapMarker[]) => void;
  onFocusMedia?: (mediaId: string) => void;
  onOpenDetail?: (item: MediaItemData) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-[#e8e8e8] bg-white sm:w-[384px]">
      <div className="flex flex-col gap-[16px] border-b border-stroke px-[16px] py-[24px]">
        <ModeToggle className="w-full" value={mode} onChange={setMode} />
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
        <MediaSearchPanel
          selectedId={selectedId}
          onSelectMedia={onSelectMedia}
          onAddProposal={onAddProposal}
        />
      )}
    </div>
  );
}
