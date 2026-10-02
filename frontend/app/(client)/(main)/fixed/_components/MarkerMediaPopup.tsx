"use client";

import { Button, Card, Chip, ScrollShadow, ToggleButton } from "@heroui/react";

import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import { MediaImageCarousel } from "@/components/common/MediaImageCarousel";
import {
  ChevronRightBoldIcon,
  FolderAddIcon,
  LocationFilledIcon,
  LoveIcon,
} from "@/components/icons";
import { useFavorite } from "@/hooks/favorites";
import type { MediaCardRow } from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 팝업 바탕색 — MapArea의 꼬리(화살표)도 같은 색으로 칠한다. */
export const POPUP_BG_CLASS = "bg-[#f1f1f3]";

function formatKrw(value: number | null): string {
  return value == null ? "-" : `${value.toLocaleString()}원`;
}

function PriceCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex flex-col gap-[2px]">
      {/* 이름표(광고비·제작비)는 모바일에서 13px로 조금 크게. */}
      <span className="text-[11px] font-medium text-black-400 max-sm:text-[13px]">
        {label}
      </span>
      {/* 모바일은 매체명과 같은 14px. */}
      <span className="text-[14px] leading-[18px] font-bold text-[#2d264b]">
        {formatKrw(value)}
      </span>
    </div>
  );
}

/** 간략히 보기의 금액 — 이름표와 금액을 한 줄에 나란히(카드를 납작하게). */
function InlinePrice({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <span className="flex items-baseline gap-[4px] whitespace-nowrap">
      <span className="text-[11px] font-medium text-black-400 max-sm:text-[12px]">
        {label}
      </span>
      <span className="text-[13px] font-bold text-[#2d264b]">
        {formatKrw(value)}
      </span>
    </span>
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
        // 꺼짐도 밝은 회색 바탕을 깔아 하트만 떠 보이지 않게 한다.
        liked
          ? "bg-[#fff1f0] data-[selected=true]:bg-[#fff1f0]"
          : "bg-black-100 data-[hovered=true]:bg-black-200",
      )}
    >
      <LoveIcon
        key={liked ? "on" : "off"}
        className={cn(
          "size-[15px] transition-colors",
          liked
            ? "animate-[admix-like-pop_280ms_ease-out] text-red-500"
            : "text-black-400",
        )}
      />
    </ToggleButton>
  );
}

/** 지도 팝업의 매체 카드 한 장 — 믹시 채팅의 추천 목록(ChatMediaList)도 같은 카드를 쓴다. */
export function MediaPopupCard({
  row,
  simple,
  selected = false,
  rank,
  tag,
  onSelect,
  onAddProposal,
}: {
  row: MediaCardRow;
  simple: boolean;
  /** 지금 지도·상세에서 보고 있는 매체면 테두리를 강조한다. */
  selected?: boolean;
  /** 추천 순위 — 있으면 매체명 앞에 번호 배지를 붙인다(믹시 추천 목록). */
  rank?: number;
  /** 카드 맨 위 보라 칩(예: "검색한 매체") + 2px 보라 테두리 — 매체 찾기 목록 카드(MediaFindCard)와 같은 모양. */
  tag?: string;
  onSelect?: () => void;
  onAddProposal?: () => void;
}) {
  const slides =
    row.images.length > 0 ? row.images : [row.thumbnailUrl ?? undefined];
  // 관심 매체 — 회원은 서버에 저장(저장되면 위쪽 알림), 비회원은 로그인 안내 알림.
  // 지도 팝업과 믹시 추천 목록(ChatMediaList)이 이 카드를 같이 쓴다.
  const { liked, toggle: toggleLiked } = useFavorite(row.id, {
    notifyName: row.name,
  });

  // 매체명은 줄임(...) 없이 아래로 줄바꿈한다. 안에 버튼(찜·담기)이 있어 카드 자체는
  // 버튼이 될 수 없으므로, 키보드는 매체명 버튼으로 상세를 연다.
  // HeroUI Button의 기본 높이·패딩·가운데 정렬·줄바꿈 금지를 풀어 글자처럼 보이게 한다.
  // 간략히 보기는 카드를 납작하게 두려고 한 줄로 줄인다(넘치면 말줄임, 전체 이름은 title로).
  const name = (
    <Button
      variant="ghost"
      onPress={() => onSelect?.()}
      className={cn(
        "h-auto min-h-0 min-w-0 flex-1 justify-start rounded-[4px] bg-transparent p-0 text-left text-[15px] max-sm:text-[14px] leading-[20px] font-bold text-black data-[hovered=true]:bg-transparent",
        simple
          ? "whitespace-nowrap"
          : "break-keep wrap-anywhere whitespace-normal",
      )}
    >
      {simple ? (
        <span className="min-w-0 truncate" title={row.name}>
          {row.name}
        </span>
      ) : (
        row.name
      )}
    </Button>
  );

  // 매체명 첫 줄(20px)에 맞춰 세로 가운데에 놓인다.
  // "검색한 매체" 칩 — 매체 찾기 목록 카드와 같은 모양(보라 바탕·흰 글자).
  const tagChip = tag && (
    <Chip className="shrink-0 rounded-[8px] bg-primary-500 px-[6px] py-[2px] text-[11px] leading-[15px] font-bold text-white max-sm:text-[10px]">
      {tag}
    </Chip>
  );
  const rankBadge = rank != null && (
    <span className="mt-[1px] inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-[5px] text-[11px] leading-none font-bold text-white tabular-nums">
      {rank}
    </span>
  );

  return (
    <Card
      onClick={onSelect}
      className={cn(
        "cursor-pointer gap-0 rounded-[12px] border bg-white shadow-none transition-colors",
        simple ? "px-[10px] py-[8px]" : "p-[10px]",
        selected ? "border-primary" : "border-black-200 hover:border-black-300",
        // 2px 보라 테두리를 카드 안쪽에 — 테두리 1px + 안쪽 1px 선(after). 팝업 스크롤 칸에 잘리지 않는다.
        tag &&
          "relative border-primary-500 hover:border-primary-500 after:pointer-events-none after:absolute after:inset-0 after:rounded-[11px] after:border after:border-primary-500 after:content-['']",
      )}
    >
      {/* "검색한 매체" 칩은 카드 맨 위(사진 위) 한 줄에 — 사진 옆 칸이 좁아 매체명 쪽에 두면 이름이 틀어진다. */}
      {tagChip && (
        <div className={cn("flex", simple ? "mb-[4px]" : "mb-[8px]")}>
          {tagChip}
        </div>
      )}
      {simple ? (
        // 납작한 한 장 — 매체명 한 줄 + 금액 한 줄, 버튼 두 개.
        // PC: 버튼을 오른쪽에 두 줄 높이로 세로 가운데. 모바일: 폭이 좁아 버튼은 매체명 줄 오른쪽에 두고
        // 금액 줄이 카드 폭 전체를 쓰게 해 한 줄에 들어가게 한다.
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-[4px] gap-y-[2px]">
          <div className="flex min-w-0 items-center gap-[4px]">
            {rankBadge && <span className="mr-[2px] flex">{rankBadge}</span>}
            {name}
          </div>
          <div className="col-start-2 row-start-1 flex gap-[4px] sm:row-span-2">
            <LikeButton liked={liked} onToggle={toggleLiked} />
            <Button
              isIconOnly
              variant="ghost"
              aria-label="제안서 담기"
              onPress={() => onAddProposal?.()}
              // 옆 관심 버튼과 같은 밝은 회색 바탕.
              className="size-[28px] min-w-0 shrink-0 rounded-[10px] bg-black-100 p-0 data-[hovered=true]:bg-black-200"
            >
              <FolderAddIcon className="size-[16px] text-primary" />
            </Button>
          </div>
          {/* 그래도 좁으면 제작비가 다음 줄로 내려간다(잘리지 않게). */}
          <div className="flex flex-wrap items-baseline gap-x-[10px] max-sm:col-span-2">
            <InlinePrice label="광고비" value={row.minAdvertisementFeeKrw} />
            {row.minProductionFeeKrw != null && (
              <InlinePrice label="제작비" value={row.minProductionFeeKrw} />
            )}
          </div>
        </div>
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
              {/* 모바일은 매체명이 여러 줄로 내려가도 순위 번호를 첫 줄에 맞춘다(가운데 정렬 대신 위). */}
              <div className="flex items-center gap-[4px] max-sm:items-start">
                {rankBadge && (
                  <span className="mr-[2px] flex [&>span]:mt-0 max-sm:[&>span]:mt-[1px]">
                    {rankBadge}
                  </span>
                )}
                {name}
                <LikeButton liked={liked} onToggle={toggleLiked} />
              </div>
              {row.address && (
                <div className="flex items-start gap-[3px]">
                  <LocationFilledIcon className="mt-[2px] size-[12px] shrink-0 text-[#6c757d]" />
                  {/* 긴 주소는 가로로 넘치지 않고 아래로 내려간다 — 남은 폭 안에서 줄어들고(min-w-0),
                      단어 단위 줄바꿈(break-keep)은 지키되 폭보다 긴 단어는 그 안에서도 넘긴다. */}
                  <span className="min-w-0 flex-1 text-[12px] max-sm:text-[11px] leading-[16px] break-keep wrap-anywhere text-[#6c757d]">
                    {row.address}
                  </span>
                </div>
              )}
              {row.categoryLarge && (
                <Chip className="min-w-0 self-start gap-0 rounded-[8px] bg-[#ededef] py-[2px] text-[11px] max-sm:text-[10px] leading-[16px] text-[#71717a]">
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
              {/* 제작비가 없으면(DOOH 등) 칸째 뺀다. */}
              {row.minProductionFeeKrw != null && (
                <PriceCell
                  label="제작비 / 1회"
                  value={row.minProductionFeeKrw}
                />
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onPress={() => onAddProposal?.()}
              className="h-[30px] shrink-0 gap-[5px] rounded-[12px] border-black-200 px-[10px]"
            >
              <FolderAddIcon className="size-[14px] shrink-0 text-primary" />
              <span className="text-[12px] max-sm:text-[11px] font-bold text-[#18181b]">
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
  highlightId,
}: {
  rows: MediaCardRow[];
  simple: boolean;
  onSimpleChange: (simple: boolean) => void;
  onSelect?: (row: MediaCardRow) => void;
  onAddProposal?: (row: MediaCardRow) => void;
  /** 검색해서 고른 매체 — 같은 주소 묶음 팝업에서 맨 위로 올리고 테두리·"검색한 매체" 표시. */
  highlightId?: string | null;
}) {
  if (rows.length === 0) return null;
  const ordered = highlightId
    ? [
        ...rows.filter((r) => r.id === highlightId),
        ...rows.filter((r) => r.id !== highlightId),
      ]
    : rows;

  return (
    <div
      className={cn(
        "flex max-h-[var(--map-popup-max-h,420px)] w-[var(--map-popup-w,min(360px,calc(100vw-24px)))] flex-col rounded-[16px] border border-black-200",
        POPUP_BG_CLASS,
      )}
    >
      <div className="flex shrink-0 items-center justify-between gap-[8px] px-[12px] pt-[10px] pb-[8px]">
        <span className="text-[13px] max-sm:text-[12px] font-medium text-black-500">
          {rows.length > 1 ? `매체 ${rows.length}개` : ""}
        </span>
        {/* 모바일은 왼쪽 "매체 N개"와 같은 12px로 작게. */}
        <SimpleViewToggle
          simple={simple}
          onChange={onSimpleChange}
          labelClassName="max-sm:text-[12px] max-sm:leading-[16px]"
        />
      </div>
      {/* 겹친 핀처럼 매체가 여러 개면 위아래 가장자리를 흐리게(HeroUI ScrollShadow) 한다. */}
      <ScrollShadow
        size={24}
        className="flex min-h-0 flex-col gap-[8px] px-[8px] pb-[8px]"
      >
        {ordered.map((row) => (
          <MediaPopupCard
            key={row.id}
            row={row}
            simple={simple}
            selected={row.id === highlightId}
            tag={row.id === highlightId ? "검색한 매체" : undefined}
            onSelect={() => onSelect?.(row)}
            onAddProposal={() => onAddProposal?.(row)}
          />
        ))}
      </ScrollShadow>
    </div>
  );
}
