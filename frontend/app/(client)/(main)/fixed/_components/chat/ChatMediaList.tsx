import type { MediaItemData } from "@/components/common/MediaItem";
import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import type { V2MediaItem } from "@/hooks/adRecommendV2";
import type { MediaCardRow } from "@/hooks/media";

import { MediaPopupCard } from "../MarkerMediaPopup";
import { formatV2Price } from "./format";

/** 채팅 추천 항목 → 지도 팝업 카드가 받는 모양. */
function toCardRow(
  it: V2MediaItem,
  id: string,
  images: string[],
): MediaCardRow {
  // 예전 세션(금액 필드 추가 전)은 price 문자열에서 숫자만 뽑아 광고비로 쓴다.
  const priceDigits = it.price?.replace(/[^0-9]/g, "");
  return {
    id,
    name: it.name || "(매체명 없음)",
    minAdvertisementFeeKrw:
      it.min_advertisement_fee_krw ??
      (priceDigits ? Number(priceDigits) : null),
    minProductionFeeKrw: it.min_production_fee_krw ?? null,
    address: it.address ?? null,
    categoryLarge: it.category_large ?? null,
    categorySmall: it.category_small ?? null,
    salesType: null,
    thumbnailUrl: images[0] ?? null,
    images,
    badge: null,
    lat: it.latitude ?? null,
    lng: it.longitude ?? null,
  };
}

/** 믹시 추천 매체 목록 — 매체 찾기 지도 핀 팝업(MarkerMediaPopup)과 같은 카드를 순위 번호와 함께 그린다. */
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
      <div className="flex items-center justify-between gap-[8px] px-[2px]">
        <span className="text-[13px] font-medium text-gray-500 max-sm:text-[14px]">
          추천 매체{" "}
          <span className="font-bold text-primary">{items.length}</span>개
        </span>
        <SimpleViewToggle
          // 모바일은 12px로 줄인다. PC는 기본값(13px) 그대로.
          labelClassName="max-sm:text-[12px]"
          simple={!showPhotos}
          onChange={(next) => onTogglePhotos(!next)}
        />
      </div>
      <div className="flex flex-col gap-[8px]">
        {items.map((it, idx) => {
          const id = it.media_id ?? it.id;
          // thumbnail_url 은 detail_images[0] 과 동일하므로 중복 제거(이미지 이중 표시 방지)
          const images: string[] = [];
          for (const u of [it.thumbnail_url, ...(it.detail_images ?? [])]) {
            if (u && !images.includes(u)) images.push(u);
          }
          return (
            <MediaPopupCard
              key={it.id}
              row={toCardRow(it, id, images)}
              simple={!showPhotos}
              selected={id === selectedId}
              rank={idx + 1}
              onSelect={() => {
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
    </div>
  );
}
