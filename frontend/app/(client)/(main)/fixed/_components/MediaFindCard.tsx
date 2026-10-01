"use client";

import {
  Button,
  Card,
  Checkbox,
  Chip,
  Label,
  Skeleton,
  ToggleButton,
} from "@heroui/react";

import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import {
  ChevronRightBoldIcon,
  FolderAddIcon,
  LayerIcon,
  LocationFilledIcon,
  LoveIcon,
} from "@/components/icons";
import { useFavorite } from "@/hooks/favorites";
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
      {/* 금액은 줄바꿈하지 않는다(예: "4,000,000원"이 "4,000,000 / 원"으로 깨지지 않게). */}
      <span className="text-[16px] whitespace-nowrap max-sm:text-[14px] font-bold text-[#2d264b]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

/**
 * 관심 매체 페이지의 고르기 버튼(시안 "04. 관심 매체") — "제안서 담기" 자리에 놓인다.
 * 제안서 상세의 "관심 매체에서 추가하기" 카드도 같은 버튼을 쓴다.
 * 끔: 흰 칩 + 빈 체크박스 + "선택", 켬: 보라 칩 + 흰 체크박스(보라 체크) + "선택됨".
 */
export function SelectToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    // 카드 클릭(상세 열기)으로 번지지 않게 막는다.
    <div
      className="absolute top-[11px] left-[11px]"
      onClick={(event) => event.stopPropagation()}
    >
      <Checkbox
        isSelected={checked}
        onChange={onChange}
        aria-label="매체 선택"
        className="group"
      >
        <Checkbox.Content
          className={cn(
            "h-[30px] gap-[6px] rounded-[12px] px-[8px] drop-shadow-[0px_2px_4px_rgba(0,0,0,0.08)] transition-colors",
            checked ? "bg-primary-500" : "bg-white",
          )}
        >
          {/* 14px 상자 — 끔은 흰 바탕·회색 테두리, 켬은 흰 상자에 보라 체크. */}
          {/* 켬은 그림자를 뺀다 — 끔 상태의 옅은 회색 그림자가 보라 바탕 위에선 흰 번짐처럼 보인다. */}
          <Checkbox.Control className="size-[14px] rounded-[5.25px] border border-[#e5e7eb] bg-white shadow-[0px_0.75px_2.25px_0px_rgba(229,231,235,0.8)] group-data-[selected=true]:border-white group-data-[selected=true]:bg-white! group-data-[selected=true]:shadow-none! group-data-[selected=true]:before:bg-white!">
            <Checkbox.Indicator className="text-primary-500 [&_svg]:stroke-primary-500! [&_svg]:text-primary-500!" />
          </Checkbox.Control>
          <Label
            className={cn(
              "cursor-pointer text-[12px] whitespace-nowrap",
              checked ? "font-bold text-white" : "text-[#111827]",
            )}
          >
            {checked ? "선택됨" : "선택"}
          </Label>
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}

export function MediaFindCard({
  row,
  selected,
  onClick,
  onAddProposal,
  selection,
}: {
  row: MediaCardRow;
  selected?: boolean;
  onClick?: () => void;
  onAddProposal?: () => void;
  /**
   * 고르기 모드(관심 매체 페이지) — 주면 "제안서 담기"·하트 대신 "선택" 체크 버튼을 두고,
   * 고른 카드는 보라 테두리(2px)로 표시한다.
   */
  selection?: { checked: boolean; onChange: (checked: boolean) => void };
}) {
  const slides =
    row.images?.length > 0 ? row.images : [row.thumbnailUrl ?? undefined];
  // 관심 매체 — 회원은 서버에 저장(저장되면 위쪽 알림), 비회원은 로그인 안내 알림.
  const { liked, setLiked } = useFavorite(row.id, { notifyName: row.name });

  return (
    <Card
      onClick={onClick}
      className={cn(
        // group — hover 때 안쪽 사진을 확대(group-hover)하려고.
        "group relative w-full shrink-0 cursor-pointer gap-0 overflow-hidden rounded-[16px] border bg-white p-0 transition-colors",
        // hover — 그림자 대신(목록 스크롤 칸 위아래에 잘려서) 테두리를 검정으로 + 사진 1.1배 확대.
        // 카드들이 형제라 다음 카드가 위에 그려져, 고른 카드는 z-10으로 올려 보라 테두리가 가리지 않게 한다.
        selected
          ? "z-10"
          : "border-black-200 shadow-none hover:border-[#18181b]",
        // 고른 카드 — 테두리 1px + 바깥 1px 그림자로 2px 보라 테두리(안쪽 내용이 밀리지 않게).
        selection?.checked &&
          "z-10 border-primary-500 shadow-[0_0_0_1px_var(--color-primary-500)] hover:border-primary-500 hover:shadow-[0_0_0_1px_var(--color-primary-500)]",
      )}
    >
      <MediaImageCarousel
        slides={slides}
        sizes="420px"
        className="h-[199px] w-full rounded-t-[15px]"
        imageClassName="group-hover:scale-[1.1]"
      >
        {selection ? (
          <SelectToggle
            checked={selection.checked}
            onChange={selection.onChange}
          />
        ) : (
          <>
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
          </>
        )}
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
          // 시안은 광고비 칸 270px 고정이지만, 두 금액이 모두 크면(98,000,000원 · 4,000,000원) 제작비가
          // 들어갈 자리가 모자라 깨진다. 제작비는 자기 폭만큼, 광고비가 남는 폭을 쓴다(둘 다 오른쪽 정렬).
          className="min-w-0 flex-1"
        />
        <PriceCell
          label="제작비 / 1회"
          value={row.minProductionFeeKrw}
          className="min-w-[89px] shrink-0"
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
