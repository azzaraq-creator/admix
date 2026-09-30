"use client";

import { Button } from "@heroui/react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";

import {
  FilterIcon,
  MapOutlineIcon,
  RotateLeftIcon,
  SearchOutlineIcon,
  SortIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

/** 시안(02. 매체 찾기)의 상단 바 — 높이 45px, 회색 필 스타일로 통일한다.
 *  모바일은 40px(모서리 40/2-3 = 17px)로 줄인다. */
const PILL =
  "flex h-[45px] items-center rounded-[20px] border border-black-200 bg-black-100 transition-colors max-sm:h-[40px] max-sm:rounded-[17px]";
/** hover·pressed에서 흰 배경으로 밝아진다. HeroUI 버튼은 data-pressed로 눌림을 알린다. */
const PILL_ACTIVE =
  "hover:bg-white active:bg-white data-[pressed=true]:bg-white";
/** HeroUI Button은 내부 svg에 자체 크기·여백을 주므로, 아이콘마다 m-0으로 되돌린다. */
const PILL_ICON = "m-0 size-[20px] shrink-0";

export function MediaFindTopBar({
  keyword,
  onKeywordChange,
  onKeywordSubmit,
  searchBoxRef,
  suggestionSlot,
  filterCount,
  filterOpen,
  onToggleFilter,
  onReset,
  resetDisabled,
  sortLabel,
  sortOpen,
  onToggleSort,
  mapExpanded,
  onToggleMapExpanded,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onKeywordSubmit: () => void;
  searchBoxRef: RefObject<HTMLDivElement | null>;
  suggestionSlot?: ReactNode;
  filterCount: number;
  filterOpen: boolean;
  onToggleFilter: () => void;
  onReset: () => void;
  /** 검색어·장소·필터 중 되돌릴 것이 하나도 없으면 초기화를 잠근다. */
  resetDisabled: boolean;
  /** 지금 고른 정렬(예: "30대 비율이 높은 순"). */
  sortLabel: string;
  sortOpen: boolean;
  onToggleSort: () => void;
  mapExpanded: boolean;
  onToggleMapExpanded: () => void;
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return;
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onKeywordSubmit();
  };

  return (
    // 모바일은 검색창을 첫 줄 전체에 두고, 필터·초기화·정렬을 둘째 줄로 내린다.
    <div className="flex items-center gap-[10px] max-sm:flex-wrap max-sm:gap-[8px]">
      <div
        ref={searchBoxRef}
        className="relative min-w-0 flex-1 max-sm:basis-full sm:max-w-[594px]"
      >
        {/* 돋보기의 좌측 여백은 상하 여백과 같아야 한다 — 테두리 1px을 뺀 안쪽
            높이 43px에서 20px 아이콘이 가운데 서면 위아래가 11.5px씩이다. */}
        <div
          className={cn(
            PILL,
            PILL_ACTIVE,
            // 모바일(안쪽 38px)은 (38 - 20) / 2 = 9px.
            "w-full gap-[14px] pr-[20px] pl-[11.5px] focus-within:border-focus focus-within:bg-white max-sm:gap-[10px] max-sm:pr-[16px] max-sm:pl-[9px]",
          )}
        >
          <SearchOutlineIcon
            className={cn(PILL_ICON, "text-black-500 max-sm:size-[18px]")}
          />
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="매체명, 지역, 주소로 검색해 보세요"
            aria-label="매체 검색"
            className="min-w-0 flex-1 bg-transparent text-[14px] max-sm:text-[13px] text-black-900 outline-none placeholder:text-black-400"
          />
        </div>
        {suggestionSlot}
      </div>

      <Button
        variant="ghost"
        onPress={onToggleFilter}
        aria-expanded={filterOpen}
        className={cn(
          PILL,
          PILL_ACTIVE,
          "shrink-0 gap-[10px] px-[20px] max-sm:gap-[6px] max-sm:px-[14px]",
          // 필터 패널이 열려 있으면 hover와 같은 흰 배경으로 켜둔다(테두리는 그대로).
          filterOpen && "bg-white",
        )}
      >
        <FilterIcon
          className={cn(PILL_ICON, "text-[#18181b] max-sm:size-[17px]")}
        />
        <span className="text-[14px] max-sm:text-[12px] font-medium whitespace-nowrap text-[#18181b]">
          필터
        </span>
        {filterCount > 0 && (
          <span className="flex size-[24px] shrink-0 items-center justify-center rounded-[9px] bg-primary text-[12px] font-medium text-white max-sm:size-[20px] max-sm:rounded-[7px] max-sm:text-[10px]">
            {filterCount}
          </span>
        )}
      </Button>

      <Button
        variant="ghost"
        isDisabled={resetDisabled}
        onPress={onReset}
        aria-label="검색 조건 초기화"
        className={cn(
          PILL,
          PILL_ACTIVE,
          "size-[45px] shrink-0 justify-center border-0 p-0 max-sm:size-[40px]",
        )}
      >
        <RotateLeftIcon
          className={cn(PILL_ICON, "text-black-500 max-sm:size-[17px]")}
        />
      </Button>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-[10px]">
        {/* 정렬 줄(MediaSortBar)은 상단 바 아래로 펼쳐진다 — 필터와 같은 "열리면 배경만 흰색" 규칙.
            TODO: 백엔드에 정렬 파라미터가 없어 골라도 목록 순서가 안 바뀐다(MediaSortBar 참고).
            API가 생길 때까지 버튼을 잠가 둔다 — 생기면 isDisabled만 지우면 된다. */}
        <Button
          variant="ghost"
          isDisabled
          onPress={onToggleSort}
          aria-expanded={sortOpen}
          className={cn(
            PILL,
            PILL_ACTIVE,
            "shrink-0 gap-[10px] px-[20px] max-sm:min-w-0 max-sm:shrink max-sm:gap-[6px] max-sm:px-[14px]",
            sortOpen && "bg-white",
          )}
        >
          <SortIcon
            className={cn(PILL_ICON, "text-[#18181b] max-sm:size-[17px]")}
          />
          <span className="text-[14px] max-sm:text-[12px] font-medium whitespace-nowrap text-black-900 max-sm:truncate">
            {sortLabel}
          </span>
        </Button>

        {/* 모바일은 목록/지도 아래쪽에 뜨는 전환 버튼(MediaFindPanel)을 대신 쓴다. */}
        <Button
          variant="ghost"
          onPress={onToggleMapExpanded}
          aria-pressed={mapExpanded}
          className="flex h-[40px] max-sm:hidden shrink-0 items-center gap-[5px] rounded-[17px] bg-black-800 px-[20px] text-white transition-colors hover:bg-black-900 active:bg-black-900 data-[pressed=true]:bg-black-900"
        >
          <MapOutlineIcon className="m-0 size-[24px] shrink-0" />
          <span className="text-[12px] whitespace-nowrap">
            {mapExpanded ? "목록 보기" : "지도 크게 보기"}
          </span>
        </Button>
      </div>
    </div>
  );
}
