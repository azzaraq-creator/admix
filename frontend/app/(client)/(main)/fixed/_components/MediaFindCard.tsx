"use client";

import { Button, Card, Chip, Skeleton, ToggleButton } from "@heroui/react";
import { useState } from "react";

import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import {
  ChevronRightBoldIcon,
  FolderAddIcon,
  LayerIcon,
  LocationFilledIcon,
  LoveIcon,
} from "@/components/icons";
import type { MediaCardRow } from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 카드 하단 금액 — 값이 없으면 시안대로 "-". */
function formatKrw(value: number | null): string {
  return value == null ? "-" : `${value.toLocaleString()}원`;
}

function PriceCell({
  label,
  value,
  className,
}: {
  label: string;
  value: number | null;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-end gap-[4px]", className)}>
      <span className="text-[11px] max-sm:text-[10px] font-medium text-black-400">
        {label}
      </span>
      <span className="text-[16px] max-sm:text-[14px] font-bold text-[#2d264b]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

export function MediaFindCard({
  row,
  selected,
  onClick,
  onAddProposal,
}: {
  row: MediaCardRow;
  selected?: boolean;
  onClick?: () => void;
  onAddProposal?: () => void;
}) {
  const slides =
    row.images?.length > 0 ? row.images : [row.thumbnailUrl ?? undefined];
  // TODO: 관심 매체 API가 없어 아직 화면 안에서만 켜고 꺼진다(새로고침하면 풀림).
  const [liked, setLiked] = useState(false);

  return (
    <Card
      onClick={onClick}
      className={cn(
        "relative w-full shrink-0 cursor-pointer gap-0 overflow-hidden rounded-[16px] border bg-white p-0 transition-shadow",
        // 카드들이 형제라 다음 카드가 위에 그려진다. 그림자가 생기는 동안만
        // z-10으로 올려 그림자가 아래 카드에 가리지 않게 한다.
        selected
          ? "z-10"
          : "border-black-200 shadow-none hover:z-10 hover:shadow-[0px_3px_10px_0px_rgba(0,0,0,0.2)] hover:border-black-300",
      )}
    >
      <MediaImageCarousel
        slides={slides}
        sizes="420px"
        className="h-[199px] w-full rounded-t-[15px]"
      >
        {/* 정렬(inline-flex·가운데)·줄바꿈 금지는 HeroUI Button 기본값이라 따로 주지 않는다.
            onPress는 카드 클릭으로 번지지 않는다. */}
        <Button
          variant="ghost"
          onPress={() => onAddProposal?.()}
          className="absolute top-[11px] left-[11px] h-[30px] gap-[6px] rounded-[12px] bg-white px-[12px] drop-shadow-[0px_2px_4px_rgba(0,0,0,0.08)]"
        >
          <FolderAddIcon className="size-[14px] shrink-0 text-primary" />
          <span className="text-[12px] max-sm:text-[11px] font-bold text-[#18181b]">
            제안서 담기
          </span>
        </Button>

        <ToggleButton
          isIconOnly
          variant="ghost"
          aria-label="관심 매체"
          isSelected={liked}
          onChange={setLiked}
          className={cn(
            "absolute top-[11px] right-[11px] size-[30px] min-w-0 rounded-[12px] p-0",
            liked
              ? "bg-[#fff1f0] data-[selected=true]:bg-[#fff1f0]"
              : "bg-white data-[hovered=true]:bg-white",
          )}
        >
          <LoveIcon
            key={liked ? "on" : "off"}
            className={cn(
              "size-[17px] transition-colors",
              liked
                ? "animate-[admix-like-pop_280ms_ease-out] text-red-500"
                : "text-black-300",
            )}
          />
        </ToggleButton>
      </MediaImageCarousel>

      <div className="flex flex-col px-[10px] pt-[11px]">
        <p className="truncate pl-[2px] text-[16px] max-sm:text-[14px] leading-[19px] font-bold text-black">
          {row.name}
        </p>

        <div className="mt-[5px] flex items-center gap-[3px]">
          <LocationFilledIcon className="size-[14px] shrink-0 text-[#6c757d]" />
          <span className="truncate text-[12px] max-sm:text-[11px] text-[#6c757d]">
            {row.address ?? "-"}
          </span>
        </div>

        <div className="mt-[8px] flex items-center justify-between gap-[8px]">
          {/* 정렬·shrink-0·가로 패딩(8px)은 HeroUI Chip 기본값이라 색·모서리·세로 여백만 준다. */}
          {row.categoryLarge ? (
            <Chip className="gap-0 rounded-[8px] bg-[#ededef] py-[3px] text-[11px] max-sm:text-[10px] leading-[16.5px] text-[#71717a]">
              {row.categoryLarge}
              {row.categorySmall && (
                <>
                  <ChevronRightBoldIcon className="size-[16px] shrink-0" />
                  {row.categorySmall}
                </>
              )}
            </Chip>
          ) : (
            <span />
          )}
          {row.salesType && (
            <Chip className="gap-[3px] rounded-[8px] bg-[#f0f5fe] py-[3px] leading-[18px] font-normal text-[#7ba7e8] max-sm:text-[11px]">
              <LayerIcon className="size-[16px] shrink-0" />
              {row.salesType}
            </Chip>
          )}
        </div>
      </div>

      <div className="mx-[10px] mt-[10px] border-t border-black-200" />

      <div className="p-[10px] flex items-center gap-[20px]">
        <PriceCell
          label="광고비 / 1개월"
          value={row.minAdvertisementFeeKrw}
          className="w-[270px] max-sm:w-auto max-sm:flex-1"
        />
        <PriceCell
          label="제작비 / 1회"
          value={row.minProductionFeeKrw}
          className="min-w-0 flex-1"
        />
      </div>
    </Card>
  );
}

/** 목록을 불러오는 동안 카드 자리를 채우는 뼈대 — MediaFindCard와 같은 크기·배치. */
export function MediaFindCardSkeleton() {
  return (
    <Card
      aria-hidden
      className="w-full shrink-0 gap-0 overflow-hidden rounded-[16px] border border-black-200 bg-white p-0 shadow-none"
    >
      <Skeleton className="h-[199px] w-full rounded-none" />
      <div className="flex flex-col gap-[8px] px-[12px] pt-[12px]">
        <Skeleton className="h-[18px] w-[60%] rounded-[6px]" />
        <Skeleton className="h-[14px] w-[80%] rounded-[6px]" />
        <Skeleton className="h-[22px] w-[110px] rounded-[8px]" />
      </div>
      <div className="mx-[10px] mt-[10px] border-t border-black-200" />
      <div className="flex justify-end gap-[20px] p-[10px]">
        <Skeleton className="h-[34px] w-[120px] rounded-[6px]" />
        <Skeleton className="h-[34px] w-[90px] rounded-[6px]" />
      </div>
    </Card>
  );
}
