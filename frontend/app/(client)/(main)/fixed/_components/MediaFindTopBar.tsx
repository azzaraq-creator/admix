"use client";

import { Button } from "@heroui/react";
import type { ComponentType, KeyboardEvent, ReactNode, RefObject } from "react";

import {
  CloseSmallIcon,
  FilterIcon,
  MapOutlineIcon,
  RotateLeftIcon,
  SearchOutlineIcon,
  type IconProps,
} from "@/components/icons";
import { SimpleViewToggle } from "@/components/common/SimpleViewToggle";
import type { PopTarget } from "@/hooks/popGrid";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import { type MediaSortKey, MediaSortSelect } from "./MediaSortSelect";
import { MediaTargetSelect } from "./MediaTargetSelect";

/** 시안(02. 매체 찾기)의 상단 바 — 높이 45px, 회색 필 스타일로 통일한다.
 *  모바일은 40px(모서리 40/2-3 = 17px)로 줄인다. */
const PILL =
  "flex h-[45px] items-center rounded-[20px] border border-gray-200 bg-gray-100 transition-colors max-sm:h-[40px] max-sm:rounded-[17px]";
/** hover·pressed에서 흰 배경으로 밝아진다. HeroUI 버튼은 data-pressed로 눌림을 알린다. */
const PILL_ACTIVE =
  "hover:bg-surface active:bg-surface data-[pressed=true]:bg-surface";
/** HeroUI Button은 내부 svg에 자체 크기·여백을 주므로, 아이콘마다 m-0으로 되돌린다. */
const PILL_ICON = "m-0 size-[20px] shrink-0";

export function MediaFindTopBar({
  keyword,
  onKeywordChange,
  onKeywordSubmit,
  onKeywordClear,
  searchBoxRef,
  suggestionSlot,
  filterCount = 0,
  filterLabel = "필터",
  filterIcon: FilterButtonIcon = FilterIcon,
  filterClassName,
  filterOpen,
  onToggleFilter,
  targets = [],
  target,
  onTargetChange,
  onReset,
  resetDisabled,
  sort,
  onSortChange,
  sortLatestLabel,
  onSortOpen,
  mapExpanded,
  onToggleMapExpanded,
  compact,
  onCompactChange,
  showMapToggle = true,
  mobileView,
}: {
  keyword: string;
  onKeywordChange: (value: string) => void;
  onKeywordSubmit: () => void;
  /** 검색창 X — 검색어를 지우고 검색 결과도 되돌린다(빈 칸에서 Enter와 같다). */
  onKeywordClear: () => void;
  searchBoxRef: RefObject<HTMLDivElement | null>;
  suggestionSlot?: ReactNode;
  filterCount?: number;
  /** 필터 버튼 이름·아이콘 — 매체 찾기는 "유동인구"(인구 분포 조건 창)을 연다. */
  filterLabel?: string;
  filterIcon?: ComponentType<IconProps>;
  /** 필터 버튼에 덧붙일 클래스 — 아이콘·글자 간격 등을 버튼마다 맞춘다. */
  filterClassName?: string;
  filterOpen: boolean;
  onToggleFilter: () => void;
  /** 타깃 버튼(인구 분포 왼쪽) — onTargetChange가 있고 노출한 타깃이 있을 때만 보인다. 고른 타깃(예: 뷰티 2030)대로 인구 분포 조건을 맞춘다. */
  targets?: PopTarget[];
  target?: number | null;
  onTargetChange?: (next: PopTarget | null) => void;
  /** 초기화 버튼 — 한 줄 배치(mobileView, 매체 찾기)에선 PC·모바일 모두 뺀다(검색어는 검색창 X, 타깃은 그 창 안에서 되돌린다). */
  onReset?: () => void;
  /** 검색어·장소·필터 중 되돌릴 것이 하나도 없으면 초기화를 잠근다. */
  resetDisabled?: boolean;
  sort: MediaSortKey;
  onSortChange: (next: MediaSortKey) => void;
  /** "최신순" 대신 쓸 이름 — 관심 매체는 "최근순". */
  sortLatestLabel?: string;
  /** 정렬 목록이 열릴 때 — 필터 패널을 닫는다. */
  onSortOpen: () => void;
  mapExpanded: boolean;
  onToggleMapExpanded: () => void;
  /** 간략히 보기(목록 카드를 작게) — onCompactChange가 있고 목록이 보일 때만 정렬 옆에 버튼이 나온다. */
  compact?: boolean;
  onCompactChange?: (next: boolean) => void;
  /** 지도 크게 보기 버튼 — 지도가 없는 화면(관심 매체)에선 뺀다. */
  showMapToggle?: boolean;
  /**
   * 매체 찾기 배치 — PC는 [검색창][정렬] ··· [필터(유동인구)][지도 크게 보기], 초기화 없음.
   * 모바일은 [검색창][오른쪽 한 칸] 한 줄 — 목록 보기면 정렬, 지도 보기면 필터 버튼
   * (정렬은 목록에만, 유동인구 창은 지도에만 필요하다). 없으면 예전처럼 [검색창][필터][초기화] ··· [정렬].
   */
  mobileView?: "list" | "map";
}) {
  const oneRow = mobileView != null;
  const isNarrow = !useIsDesktop();
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") return;
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    onKeywordSubmit();
    // 터치 기기는 키보드의 "검색"을 누르면 키보드를 내려 결과가 보이게 한다. PC는 이어서 고칠 수 있게 포커스를 둔다.
    if (window.matchMedia("(hover: none) and (pointer: coarse)").matches) {
      event.currentTarget.blur();
    }
  };

  const filterButton = (
    // 숫자는 버튼 오른쪽 위 모서리에 걸친 배지 — 버튼 밖으로 나가므로 감싼 칸에 띄운다(버튼이 넘침을 자를 수 있다).
    <div
      className={cn(
        "relative shrink-0",
        oneRow && mobileView === "list" && "max-sm:hidden",
      )}
    >
      <Button
        variant="ghost"
        onPress={onToggleFilter}
        aria-expanded={filterOpen}
        // 필터 패널이 바깥 누름으로 닫힐 때 이 버튼은 빼 둔다(눌러서 닫은 뒤 다시 열리지 않게).
        data-filter-toggle
        className={cn(
          PILL,
          PILL_ACTIVE,
          "shrink-0 gap-[10px] px-[20px] max-sm:gap-[6px] max-sm:px-[14px]",
          filterClassName,
          // 필터 패널이 열려 있으면 hover와 같은 흰 배경으로 켜둔다(테두리는 그대로).
          filterOpen && "bg-surface",
        )}
      >
        <FilterButtonIcon
          className={cn(PILL_ICON, "text-zinc-900 max-sm:size-[17px]")}
        />
        <span className="text-[14px] max-sm:text-[12px] font-medium whitespace-nowrap text-zinc-900">
          {filterLabel}
        </span>
      </Button>
      {filterCount > 0 && (
        <span className="pointer-events-none absolute -top-[6px] -right-[6px] flex size-[20px] items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white ring-2 ring-surface max-sm:-top-[5px] max-sm:-right-[5px] max-sm:size-[18px] max-sm:text-[10px]">
          {filterCount}
        </span>
      )}
    </div>
  );

  // 모바일 한 줄 배치에선 필터 버튼처럼 지도 보기에서만 보인다.
  const targetButton = onTargetChange && targets.length > 0 && (
    <MediaTargetSelect
      targets={targets}
      value={target ?? null}
      onChange={onTargetChange}
      className={cn(oneRow && mobileView === "list" && "max-sm:hidden")}
    />
  );

  const resetButton = (
    <Button
      variant="ghost"
      isDisabled={resetDisabled}
      onPress={onReset}
      aria-label="검색 조건 초기화"
      className={cn(
        PILL,
        PILL_ACTIVE,
        "size-[45px] shrink-0 justify-center p-0 max-sm:size-[40px]",
      )}
    >
      <RotateLeftIcon
        className={cn(PILL_ICON, "text-gray-500 max-sm:size-[17px]")}
      />
    </Button>
  );

  const sortSelect = (
    <MediaSortSelect
      value={sort}
      onChange={onSortChange}
      latestLabel={sortLatestLabel}
      onOpenChange={(open) => open && onSortOpen()}
      triggerClassName={cn(
        PILL,
        PILL_ACTIVE,
        "gap-[10px] px-[20px] max-sm:min-w-0 max-sm:gap-[6px] max-sm:px-[14px]",
      )}
      iconClassName={cn(PILL_ICON, "text-zinc-900 max-sm:size-[17px]")}
    />
  );

  // 간략히 보기 — 목록을 다루는 정렬 바로 옆. 지도 팝업 매체 목록의 "간략히 보기" 스위치와 같은 모양.
  const compactToggle = onCompactChange && !mapExpanded && (
    <SimpleViewToggle
      simple={!!compact}
      onChange={onCompactChange}
      className="shrink-0"
      labelClassName="whitespace-nowrap max-sm:text-[12px]"
    />
  );

  // 모바일은 목록/지도 아래쪽에 뜨는 전환 버튼(MediaFindPanel)을 대신 쓴다.
  const mapToggle = showMapToggle && (
    <Button
      variant="ghost"
      onPress={onToggleMapExpanded}
      aria-pressed={mapExpanded}
      className="flex h-[45px] max-sm:hidden shrink-0 items-center gap-[5px] rounded-[20px] bg-gray-800 px-[20px] text-white transition-colors hover:bg-gray-900 active:bg-gray-900 data-[pressed=true]:bg-gray-900 dark:bg-gray-200 dark:hover:bg-gray-300 dark:active:bg-gray-300 dark:data-[pressed=true]:bg-gray-300"
    >
      <MapOutlineIcon className="m-0 size-[24px] shrink-0" />
      <span className="text-[12px] whitespace-nowrap">
        {mapExpanded ? "목록 보기" : "지도 크게 보기"}
      </span>
    </Button>
  );

  return (
    // 모바일·태블릿은 검색창을 첫 줄 전체에 두고, 필터·초기화·정렬을 둘째 줄로 내린다
    // (태블릿 폭에서 한 줄에 두면 정렬·지도 버튼이 필터 위로 겹친다). 모바일 한 줄 배치(mobileView)는 아래 설명.
    <div
      className={cn(
        "flex items-center gap-[10px] max-lg:flex-wrap max-sm:gap-[8px]",
        oneRow && "max-sm:flex-nowrap",
      )}
    >
      <div
        ref={searchBoxRef}
        className={cn(
          "relative min-w-0 flex-1 max-lg:basis-full lg:max-w-[594px]",
          oneRow && "max-sm:basis-auto",
        )}
      >
        {/* 돋보기의 좌측 여백은 상하 여백과 같아야 한다 — 테두리 1px을 뺀 안쪽
            높이 43px에서 20px 아이콘이 가운데 서면 위아래가 11.5px씩이다. */}
        <div
          className={cn(
            PILL,
            PILL_ACTIVE,
            // 모바일(안쪽 38px)은 (38 - 20) / 2 = 9px.
            "w-full gap-[14px] pr-[20px] pl-[11.5px] focus-within:border-focus focus-within:bg-surface max-sm:gap-[10px] max-sm:pr-[16px] max-sm:pl-[9px]",
          )}
        >
          <SearchOutlineIcon
            className={cn(PILL_ICON, "text-gray-500 max-sm:size-[18px]")}
          />
          <input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onKeyDown={handleKeyDown}
            // 모바일 키보드의 엔터 키를 "검색"으로 표시한다.
            enterKeyHint="search"
            // 모바일 한 줄 배치는 검색창이 좁아 안내 문구를 줄인다.
            placeholder={
              oneRow && isNarrow
                ? "매체명·지역·주소 검색"
                : "매체명, 지역, 주소로 검색해 보세요"
            }
            aria-label="매체 검색"
            className="min-w-0 flex-1 bg-transparent text-[14px] max-sm:text-[13px] text-gray-900 outline-none placeholder:text-gray-400"
          />
          {/* 검색어 지우기 — 글자가 있을 때만. 버튼 22px → 곡률 원형. */}
          {keyword && (
            <button
              type="button"
              aria-label="검색어 지우기"
              onClick={onKeywordClear}
              className="-mr-[6px] flex size-[22px] shrink-0 items-center justify-center rounded-full bg-gray-300 text-white transition-colors hover:bg-gray-400 max-sm:-mr-[4px] max-sm:size-[20px]"
            >
              <CloseSmallIcon className="size-[14px] max-sm:size-[12px]" />
            </button>
          )}
        </div>
        {suggestionSlot}
      </div>

      {oneRow ? (
        // 매체 찾기 — [검색창][정렬][간략히] ··· [타깃][인구 분포][지도 크게 보기], 초기화 없음.
        <>
          <div
            className={cn(
              "flex shrink-0 items-center gap-[10px] max-sm:gap-[8px]",
              mobileView === "map" && "max-sm:hidden",
            )}
          >
            {sortSelect}
            {compactToggle}
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-[10px] max-sm:flex-none">
            {targetButton}
            {filterButton}
            {mapToggle}
          </div>
        </>
      ) : (
        <>
          {filterButton}
          {resetButton}
          <div className="flex min-w-0 flex-1 items-center justify-end gap-[10px]">
            {sortSelect}
            {compactToggle}
            {mapToggle}
          </div>
        </>
      )}
    </div>
  );
}
