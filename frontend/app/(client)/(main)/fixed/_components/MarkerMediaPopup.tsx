"use client";

import { Button, Card, Chip, ToggleButton } from "@heroui/react";
import { useState } from "react";

import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import {
  ChevronRightBoldIcon,
  FolderAddIcon,
  LocationFilledIcon,
  LoveIcon,
} from "@/components/icons";
import type { MediaCardRow } from "@/hooks/media";
import { cn } from "@/lib/utils";

import { MediaImageCarousel } from "./MediaImageCarousel";

/** 팝업 바탕색 — MapArea의 꼬리(화살표)도 같은 색으로 칠한다. */
export const POPUP_BG_CLASS = "bg-[#f1f1f3]";

function formatKrw(value: number | null): string {
  return value == null ? "-" : `${value.toLocaleString()}원`;
}

function PriceCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col gap-[2px]">
      <span className="text-[11px] font-medium text-black-400">{label}</span>
      <span className="text-[14px] leading-[18px] font-bold text-[#2d264b]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

function LikeButton({
  liked,
  onToggle,
}: {
  liked: boolean;
  onToggle: () => void;
}) {
  return (
    // onChange(press)는 카드 클릭(상세 열기)으로 번지지 않는다.
    <ToggleButton
      isIconOnly
      variant="ghost"
      size="sm"
      aria-label="관심 매체"
      isSelected={liked}
      onChange={onToggle}
      className={cn(
        "size-[28px] min-w-0 shrink-0 rounded-[10px] p-0",
        liked && "bg-[#fff1f0] data-[selected=true]:bg-[#fff1f0]",
      )}
    >
      <LoveIcon
        key={liked ? "on" : "off"}
        className={cn(
          "size-[15px] transition-colors",
          liked
            ? "animate-[admix-like-pop_280ms_ease-out] text-red-500"
            : "text-black-300",
        )}
      />
    </ToggleButton>
  );
}

function PopupCard({
  row,
  simple,
  onSelect,
  onAddProposal,
}: {
  row: MediaCardRow;
  simple: boolean;
  onSelect?: () => void;
  onAddProposal?: () => void;
}) {
  const slides =
    row.images.length > 0 ? row.images : [row.thumbnailUrl ?? undefined];
  // TODO: 관심 매체 API가 없어 목록 카드와 마찬가지로 화면 안에서만 켜고 꺼진다.
  // 간략히 보기를 오가도 유지되도록 카드 단위로 들고 있는다.
  const [liked, setLiked] = useState(false);
  const toggleLiked = () => setLiked((prev) => !prev);

  // 매체명은 줄임(...) 없이 아래로 줄바꿈한다. 안에 버튼(찜·담기)이 있어 카드 자체는
  // 버튼이 될 수 없으므로, 키보드는 매체명 버튼으로 상세를 연다.
  // HeroUI Button의 기본 높이·패딩·가운데 정렬·줄바꿈 금지를 풀어 글자처럼 보이게 한다.
  const name = (
    <Button
      variant="ghost"
      onPress={() => onSelect?.()}
      className="h-auto min-h-0 min-w-0 flex-1 justify-start rounded-[4px] bg-transparent p-0 text-left text-[15px] leading-[20px] font-bold break-keep whitespace-normal text-black data-[hovered=true]:bg-transparent"
    >
      {row.name}
    </Button>
  );

  return (
    <Card
      onClick={onSelect}
      className="cursor-pointer gap-0 rounded-[12px] border border-black-200 bg-white p-[10px] shadow-none transition-colors hover:border-black-300"
    >
      {simple ? (
        <>
          <div className="flex items-start gap-[4px]">
            {name}
            <LikeButton liked={liked} onToggle={toggleLiked} />
            <Button
              isIconOnly
              variant="ghost"
              aria-label="제안서 담기"
              onPress={() => onAddProposal?.()}
              className="size-[28px] min-w-0 shrink-0 rounded-[10px] p-0"
            >
              <FolderAddIcon className="size-[16px] text-primary" />
            </Button>
          </div>
          <div className="mt-[6px] flex gap-[16px]">
            <PriceCell
              label="광고비 / 1개월"
              value={row.minAdvertisementFeeKrw}
            />
            <PriceCell label="제작비 / 1회" value={row.minProductionFeeKrw} />
          </div>
        </>
      ) : (
        <>
          <div className="flex gap-[12px]">
            <MediaImageCarousel
              slides={slides}
              sizes="96px"
              logoClassName="size-[24px]"
              className="size-[96px] shrink-0 rounded-[10px]"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
              <div className="flex items-start gap-[4px]">
                {name}
                <LikeButton liked={liked} onToggle={toggleLiked} />
              </div>
              {row.address && (
                <div className="flex items-start gap-[3px]">
                  <LocationFilledIcon className="mt-[2px] size-[12px] shrink-0 text-[#6c757d]" />
                  <span className="text-[12px] leading-[16px] break-keep text-[#6c757d]">
                    {row.address}
                  </span>
                </div>
              )}
              {row.categoryLarge && (
                <Chip className="min-w-0 self-start gap-0 rounded-[8px] bg-[#ededef] py-[2px] text-[11px] leading-[16px] text-[#71717a]">
                  {row.categoryLarge}
                  {row.categorySmall && (
                    <>
                      <ChevronRightBoldIcon className="size-[14px] shrink-0" />
                      {row.categorySmall}
                    </>
                  )}
                </Chip>
              )}
            </div>
          </div>

          <div className="mt-[10px] flex items-end justify-between gap-[8px] border-t border-black-200 pt-[8px]">
            <div className="flex gap-[16px]">
              <PriceCell
                label="광고비 / 1개월"
                value={row.minAdvertisementFeeKrw}
              />
              <PriceCell label="제작비 / 1회" value={row.minProductionFeeKrw} />
            </div>
            <Button
              variant="outline"
              size="sm"
              onPress={() => onAddProposal?.()}
              className="h-[30px] shrink-0 gap-[5px] rounded-[12px] border-black-200 px-[10px]"
            >
              <FolderAddIcon className="size-[14px] shrink-0 text-primary" />
              <span className="text-[12px] font-bold text-[#18181b]">
                제안서 담기
              </span>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

/**
 * 지도 핀/겹침핀을 눌렀을 때 뜨는 매체 요약. 왼쪽 목록 카드(MediaFindCard)와 글꼴·칩·금액
 * 표기는 맞추되, 지도를 덜 가리게 작은 이미지 + 핵심 정보만 담는다. 누르면 상세가 열린다.
 * 매체마다 흰 카드로 떼어 회색 바탕 위에 쌓아, 겹친 매체가 여럿이어도 경계가 분명하게 한다.
 * 간략히 보기는 이미지·주소·분류를 빼고 이름·금액·아이콘 버튼만 남긴다.
 * 그림자·꼬리는 지도 쪽(MapArea)이 그린다.
 */
export function MarkerMediaPopup({
  rows,
  simple,
  onSimpleChange,
  onSelect,
  onAddProposal,
}: {
  rows: MediaCardRow[];
  simple: boolean;
  onSimpleChange: (simple: boolean) => void;
  onSelect?: (row: MediaCardRow) => void;
  onAddProposal?: (row: MediaCardRow) => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "flex max-h-[var(--map-popup-max-h,420px)] w-[min(360px,calc(100vw-24px))] flex-col rounded-[16px] border border-black-200",
        POPUP_BG_CLASS,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-[8px] px-[12px] pt-[10px] pb-[8px]">
        <span className="text-[13px] font-medium text-black-500">
          {rows.length > 1 ? `매체 ${rows.length}개` : ""}
        </span>
        <SimpleViewToggle simple={simple} onChange={onSimpleChange} />
      </div>
      <div className="flex min-h-0 flex-col gap-[8px] overflow-y-auto px-[8px] pb-[8px]">
        {rows.map((row) => (
          <PopupCard
            key={row.id}
            row={row}
            simple={simple}
            onSelect={() => onSelect?.(row)}
            onAddProposal={() => onAddProposal?.(row)}
          />
        ))}
      </div>
    </div>
  );
}
