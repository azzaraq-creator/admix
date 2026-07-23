import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import type { V2MediaItem } from "@/hooks/adRecommendV2";

import { formatV2Price } from "./format";

export function ChatMediaList({
  items,
  selectedId,
  onSelectMedia,
  onFocusMedia,
  showPhotos,
  onTogglePhotos,
  onAddProposal,
}: {
  items: V2MediaItem[];
  selectedId?: string;
  onSelectMedia?: (item: MediaItemData) => void;
  onFocusMedia?: (mediaId: string) => void;
  showPhotos: boolean;
  onTogglePhotos: (next: boolean) => void;
  onAddProposal?: (mediaId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[8px]">
      <div className="flex justify-end">
        <SimpleViewToggle
          simple={!showPhotos}
          onChange={(next) => onTogglePhotos(!next)}
        />
      </div>
      {items.map((it, idx) => {
        const id = it.media_id ?? it.id;
        // thumbnail_url 은 detail_images[0] 과 동일하므로 중복 제거(이미지 이중 표시 방지)
        const images: string[] = [];
        for (const u of [it.thumbnail_url, ...(it.detail_images ?? [])]) {
          if (u && !images.includes(u)) images.push(u);
        }
        return (
          <MediaItem
            key={it.id}
            id={id}
            name={it.name || "(매체명 없음)"}
            price={formatV2Price(it.price)}
            images={images}
            rank={idx + 1}
            simple={!showPhotos}
            selected={id === selectedId}
            onClick={() => {
              onSelectMedia?.({
                id,
                name: it.name,
                price: formatV2Price(it.price),
                images,
              });
              onFocusMedia?.(id);
            }}
            onAddProposal={() => onAddProposal?.(id)}
          />
        );
      })}
    </div>
  );
}
