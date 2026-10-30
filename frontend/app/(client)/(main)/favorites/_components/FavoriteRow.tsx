"use client";

import { Card, Checkbox, Skeleton } from "@heroui/react";

import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import { LocationFilledIcon } from "@/components/icons";
import type { MediaCardRow } from "@/hooks/media";
import { cn } from "@/lib/utils";
import { formatAdFee } from "@/lib/media";

/**
 * 모바일 관심 매체 한 줄 — 카드 한 장이 화면을 다 차지해 한 번에 1~2개밖에 안 보여서,
 * 왼쪽 작은 사진(88px) + 오른쪽 매체명·주소·금액의 가로 한 줄로 촘촘히 보인다.
 * 사진 왼쪽 위 체크박스로 고르고(HeroUI Checkbox), 줄을 누르면 매체 정보 팝업을 연다.
 * 고른 줄은 카드처럼 보라 테두리(2px).
 */
export function FavoriteRow({
  row,
  checked,
  onCheckedChange,
  onOpen,
}: {
  row: MediaCardRow;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onOpen: () => void;
}) {
  return (
    <Card
      onClick={onOpen}
      className={cn(
        "cursor-pointer flex-row items-center gap-[12px] rounded-[14px] border bg-surface p-[10px] shadow-none transition-colors",
        checked
          ? "border-primary-500 shadow-[0_0_0_1px_var(--color-primary-500)]"
          : "border-gray-200",
      )}
    >
      {/* 사진이 여러 장이면 끌거나 점을 눌러 넘긴다(매체 찾기 간략히 보기와 같다). */}
      <MediaImageCarousel
        slides={
          row.images?.length > 0 ? row.images : [row.thumbnailUrl ?? undefined]
        }
        sizes="88px"
        small
        logoClassName="size-[24px]"
        className="size-[88px] shrink-0 rounded-[10px]"
      >
        {/* 사진 위 체크박스 — 줄 클릭(상세 열기)으로 번지지 않게 막는다. 칸 26px → 곡률 9px. */}
        <div
          className="absolute top-[6px] left-[6px]"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            isSelected={checked}
            onChange={onCheckedChange}
            aria-label={`${row.name} 선택`}
            className="group"
          >
            <Checkbox.Content className="size-[26px] items-center justify-center rounded-[9px] bg-surface/90 drop-shadow-[0px_1px_3px_rgba(0,0,0,0.15)] group-data-[selected=true]:bg-primary-500">
              <Checkbox.Control className="size-[14px] rounded-[5.25px] border border-zinc-300 bg-surface shadow-none group-data-[selected=true]:border-white group-data-[selected=true]:bg-surface! group-data-[selected=true]:before:bg-surface!">
                <Checkbox.Indicator className="[&_svg]:stroke-primary-500! [&_svg]:text-primary-500!" />
              </Checkbox.Control>
            </Checkbox.Content>
          </Checkbox>
        </div>
      </MediaImageCarousel>

      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <p className="truncate text-[14px] leading-[20px] font-bold text-black">
          {row.name}
        </p>
        <div className="flex min-w-0 items-center gap-[3px]">
          <LocationFilledIcon className="size-[12px] shrink-0 text-tone-6c757d" />
          <span className="truncate text-[11px] text-tone-6c757d">
            {row.address ?? "-"}
          </span>
        </div>
        <div className="mt-[4px] flex flex-col gap-[1px]">
          <PriceLine label="광고비" value={row.minAdvertisementFeeKrw} />
          {row.minProductionFeeKrw != null && (
            <PriceLine label="제작비" value={row.minProductionFeeKrw} />
          )}
        </div>
      </div>
    </Card>
  );
}

function PriceLine({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline gap-[6px] whitespace-nowrap">
      <span className="w-[34px] shrink-0 text-[11px] font-medium text-gray-400">
        {label}
      </span>
      {/* 광고비 줄만 값이 비어 들어온다(제작비는 없으면 줄째 숨김) — 없으면 "별도 문의". */}
      <span className="text-[13px] font-bold text-tone-2d264b">
        {formatAdFee(value)}
      </span>
    </div>
  );
}

/** 불러오는 동안의 한 줄 — FavoriteRow와 같은 크기·배치. */
export function FavoriteRowSkeleton() {
  return (
    <div className="flex items-center gap-[12px] rounded-[14px] border border-gray-200 bg-surface p-[10px]">
      <Skeleton className="size-[88px] shrink-0 rounded-[10px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
        <Skeleton className="h-[16px] w-[70%] rounded-[6px]" />
        <Skeleton className="h-[12px] w-[55%] rounded-[6px]" />
        <Skeleton className="h-[12px] w-[50%] rounded-[6px]" />
        <Skeleton className="h-[12px] w-[45%] rounded-[6px]" />
      </div>
    </div>
  );
}
