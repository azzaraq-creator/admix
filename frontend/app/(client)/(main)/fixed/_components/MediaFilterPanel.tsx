"use client";

import {
  Button,
  Chip,
  ScrollShadow,
  Spinner,
  Tag,
  TagGroup,
} from "@heroui/react";
import { useEffect, useState } from "react";

import {
  EMPTY_MEDIA_FILTER,
  FILTER_DIMS,
  dimSelectionCount,
  type ChipDimKey,
  type FilterOption,
  type FilterPanelKey,
  type MediaFilterState,
  type PriceMeta,
  toChipFilterParams,
} from "@/components/common/mediaFilter/filterConfig";
import { PriceRangeFilter } from "@/components/common/mediaFilter/PriceRangeFilter";
import { RotateLeftIcon } from "@/components/icons";
import { useFavoriteList, useFavoritePriceHistogram } from "@/hooks/favorites";
import {
  useMediaFindCount,
  useFixedPriceHistogram,
  type MediaFilterParams,
  type RegionOption,
} from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 시안(02. 매체 찾기 - 필터)의 탭 순서. 지역은 regions 를 넘길 때만 보인다. */
type TabKey = FilterPanelKey | "region";

const TABS: { key: TabKey; label: string }[] = [
  { key: "region", label: "지역" },
  { key: "category", label: "카테고리" },
  { key: "price", label: "가격 범위" },
  { key: "oohType", label: "매체 타입" },
  { key: "saleType", label: "판매 유형" },
  { key: "exposureType", label: "설치 장소" },
  { key: "mediaShape", label: "매체 형태" },
];

/** 패널 탭 모양 — 정렬 패널(MediaSortBar)의 Select 트리거도 같은 모양을 쓴다. */
export const TAB_BASE =
  "flex h-[38px] shrink-0 items-center gap-[8px] rounded-[16px] px-[20px] text-[14px] max-sm:text-[12px] transition-colors";
// 선택된 탭의 테두리는 #9aa0b4(= gray-400).
export const TAB_ACTIVE =
  "border border-gray-400 bg-white font-bold text-gray-900";
export const TAB_IDLE =
  "bg-transparent font-medium text-gray-500 hover:bg-transparent hover:text-gray-900";

export function TabButton({
  label,
  count,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      isDisabled={disabled}
      onPress={onClick}
      className={cn(
        TAB_BASE,
        active ? TAB_ACTIVE : TAB_IDLE,
        disabled && "cursor-not-allowed opacity-40 hover:text-gray-500",
      )}
    >
      {label}
      {count > 0 && (
        // 색은 지정하지 않고 탭 글자색(선택·hover 상태 포함)을 그대로 따른다.
        <span className="text-[13px] max-sm:text-[11px] font-semibold">
          {count}
        </span>
      )}
    </Button>
  );
}

/** 두 필터 선택이 같은지(값 순서 무관). */
function sameFilter(a: MediaFilterState, b: MediaFilterState): boolean {
  const sameRegion =
    [...a.region].sort().join("\u0000") === [...b.region].sort().join("\u0000");
  return (
    sameRegion &&
    FILTER_DIMS.every((dim) => {
      if (dim.key === "price")
        return a.priceMin === b.priceMin && a.priceMax === b.priceMax;
      const x = [...a[dim.key]].sort().join("\u0000");
      const y = [...b[dim.key]].sort().join("\u0000");
      return x === y;
    })
  );
}

// 패널에서 선택을 바꾼 뒤 개수를 다시 셀 때까지 기다리는 시간 — 가격 슬라이더를 끄는 동안
// 요청이 쏟아지지 않게 멈춘 뒤에만 조회한다.
const COUNT_DEBOUNCE_MS = 300;

/** 칩·가격 중 하나라도 걸려 있으면 true. FILTER_DIMS가 전 차원을 덮는다. */
function hasSelection(f: MediaFilterState): boolean {
  return (
    f.region.length > 0 ||
    FILTER_DIMS.some((dim) => dimSelectionCount(dim.key, f) > 0)
  );
}

const ALL_DISTRICTS = "__all__";

/**
 * 지역 — 위 줄에서 시·도를 고르면 아래 줄에 그 안의 구·군이 나온다(여러 개, 시·도를 넘나들어도 된다).
 * "전체"는 그 시·도 전체 — 구·군을 고르면 풀리고, 전체를 고르면 고른 구·군이 풀린다.
 * 값: "서울특별시"(시·도 전체) / "서울특별시 강남구".
 */
function RegionFilter({
  regions,
  value,
  onChange,
}: {
  regions: RegionOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [sido, setSido] = useState(
    () =>
      regions.find((r) =>
        value.some((v) => v === r.sido || v.startsWith(`${r.sido} `)),
      )?.sido ??
      regions[0]?.sido ??
      "",
  );
  const current = regions.find((r) => r.sido === sido);
  if (!current) {
    return (
      <p className="text-[13px] text-gray-500 max-sm:text-[11px]">
        지역 정보를 불러오지 못했어요.
      </p>
    );
  }
  const prefix = `${sido} `;
  const whole = value.includes(sido);
  const picked = value
    .filter((v) => v.startsWith(prefix))
    .map((v) => v.slice(prefix.length));
  const pickCount = (r: RegionOption) =>
    value.filter((v) => v === r.sido || v.startsWith(`${r.sido} `)).length;

  return (
    <div className="flex flex-col gap-[14px]">
      <TagGroup
        aria-label="시·도"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([sido])}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next != null) setSido(String(next));
        }}
      >
        <TagGroup.List className="flex flex-wrap gap-[8px]">
          {regions.map((r) => (
            <Tag key={r.sido} id={r.sido} className={OPTION_TAG}>
              {r.label}
              {pickCount(r) > 0 && (
                <span className="ml-[4px] text-primary-500">
                  {pickCount(r)}
                </span>
              )}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
      <div className="flex flex-col gap-[10px] rounded-[16px] bg-gray-50 p-[14px] max-sm:p-[12px]">
        <TagGroup
          aria-label={`${current.label} 구·군`}
          selectionMode="multiple"
          selectedKeys={new Set(whole ? [ALL_DISTRICTS] : picked)}
          onSelectionChange={(keys) => {
            const next =
              keys === "all" ? [ALL_DISTRICTS] : [...keys].map(String);
            const others = value.filter(
              (v) => v !== sido && !v.startsWith(prefix),
            );
            const mine =
              next.includes(ALL_DISTRICTS) && !whole
                ? [sido]
                : next
                    .filter((k) => k !== ALL_DISTRICTS)
                    .map((d) => `${sido} ${d}`);
            onChange([...others, ...mine]);
          }}
        >
          <TagGroup.List className="flex flex-wrap gap-[8px]">
            <Tag id={ALL_DISTRICTS} className={OPTION_TAG}>
              {current.label} 전체
            </Tag>
            {current.districts.map((d) => (
              <Tag key={d} id={d} className={OPTION_TAG}>
                {d}
              </Tag>
            ))}
          </TagGroup.List>
        </TagGroup>
        <p className="text-[12px] text-gray-500 max-sm:text-[11px]">
          이동 매체는 운행 지역으로 찾아요. 시·도 전체를 다니는 매체와 전국
          매체는 구·군을 골라도 함께 나와요.
        </p>
      </div>
    </div>
  );
}

// 옵션 태그 — 높이 32px, 모서리는 (높이/2)-3px = 13px.
// 선택 시 테두리 #9aa0b4(= gray-400) + gray-900 볼드. HeroUI Tag의 기본 배경·선택 색은
// bg-white로 덮는다(유틸리티 레이어가 컴포넌트 레이어보다 뒤에 와서 그대로 이긴다).
const OPTION_TAG = cn(
  "flex h-[32px] shrink-0 items-center rounded-[13px] border border-gray-200 bg-white px-[14px] text-[13px] max-sm:text-[11px] font-medium text-gray-600 transition-colors",
  "hover:border-gray-300",
  "data-[selected=true]:border-gray-400 data-[selected=true]:font-bold data-[selected=true]:text-gray-900",
);

export function MediaFilterPanel({
  value,
  optionsByKey,
  price,
  regions,
  totalCount,
  scope,
  countSource = "fixed",
  onApply,
  onReset,
  onClose,
}: {
  value: MediaFilterState;
  optionsByKey: Record<ChipDimKey, FilterOption[]>;
  price: PriceMeta;
  /** 지역 선택지 — 넘기면 지역 탭이 보인다(매체 찾기·관심 매체). */
  regions?: RegionOption[];
  /** 이미 적용된 필터의 결과 수 — 패널 선택이 적용된 것과 같으면 다시 세지 않고 이 값을 쓴다. */
  totalCount: number;
  /** 필터 외 조회 조건(지도 영역·검색어·매체 찾기 탭). 패널 선택의 개수를 셀 때 함께 건다. */
  scope: Pick<
    MediaFilterParams,
    "neLat" | "swLat" | "neLng" | "swLng" | "keyword" | "source"
  >;
  /** 결과 수를 셀 대상 — 매체 찾기(고른 탭 — 전체면 고정 매체 + 그 영역을 다니는 이동매체) 또는 관심 매체(내가 하트한 매체). */
  countSource?: "fixed" | "favorites";
  onApply: (next: MediaFilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // 패널 안에서만 쓰는 임시 상태 — "결과 보기"를 눌러야 URL(=조회)에 반영된다.
  const [draft, setDraft] = useState<MediaFilterState>(value);
  // 처음 여는 탭 — 지역 탭이 있으면 지역, 없으면 카테고리.
  const [tab, setTab] = useState<TabKey>(regions ? "region" : "category");

  // 선택이 멈추면 그 조건으로 결과 수를 다시 센다. 적용된 필터와 같으면 목록의 total을 그대로 쓴다.
  const [settledDraft, setSettledDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setSettledDraft(draft), COUNT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  const sameAsApplied = sameFilter(settledDraft, value);
  // 지역을 고르면 적용할 때 지도 영역을 떼고 그 지역 전체에서 찾으므로, 개수·가격 그래프도 영역 없이 센다.
  const draftScope =
    settledDraft.region.length > 0
      ? { ...scope, neLat: null, swLat: null, neLng: null, swLng: null }
      : scope;
  const countParams = { ...toChipFilterParams(settledDraft), ...draftScope };
  const findCount = useMediaFindCount(
    countParams,
    !sameAsApplied && countSource === "fixed",
  );
  const favoriteCount = useFavoriteList(
    countParams,
    !sameAsApplied && countSource === "favorites",
  );
  const countQuery =
    countSource === "favorites"
      ? { ...favoriteCount, data: favoriteCount.data?.total }
      : findCount;
  const counting =
    !sameFilter(draft, settledDraft) ||
    (!sameAsApplied && (countQuery.isFetching || countQuery.data == null));
  const count = sameAsApplied ? totalCount : countQuery.data;

  // 가격 그래프 막대 — 전체 매체가 아니라 지금 목록(지도 영역·검색어)과 패널에서 고른 다른 필터 기준.
  // 가격 자체는 빼고 센다(고른 가격 밖의 분포도 보여야 범위를 옮길 수 있다). 가로축은 전체 기준 그대로.
  const histogramParams = {
    ...toChipFilterParams(settledDraft),
    priceMin: null,
    priceMax: null,
    ...draftScope,
  };
  const fixedHistogram = useFixedPriceHistogram(
    histogramParams,
    !!price && countSource === "fixed",
  );
  const favoriteHistogram = useFavoritePriceHistogram(
    histogramParams,
    !!price && countSource === "favorites",
  );
  const histogram =
    (countSource === "favorites" ? favoriteHistogram : fixedHistogram).data ??
    price?.histogram ??
    [];

  const tabCount = (key: TabKey) => dimSelectionCount(key, draft);
  const tabs = TABS.filter((t) => t.key !== "region" || regions);

  // 되돌릴 게 없으면(패널에서 고른 것도, 이미 적용된 것도 없으면) 초기화를 잠근다.
  const resetDisabled = !hasSelection(draft) && !hasSelection(value);

  return (
    <div className="flex flex-col rounded-[20px] border border-gray-200 bg-white shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]">
      {/* 탭 줄 — 모바일처럼 좁아 옆으로 넘치면 넘길 게 남은 쪽 가장자리를 흐리게(HeroUI ScrollShadow) 한다.
          아래 구분선은 바깥 칸에 두어 흐림(마스크)에 같이 지워지지 않게 한다. */}
      <div className="border-b border-gray-200">
        <ScrollShadow
          orientation="horizontal"
          hideScrollBar
          size={24}
          className="flex items-center gap-[4px] px-[16px] py-[12px] max-sm:px-[12px] max-sm:py-[10px]"
        >
          {tabs.map(({ key, label }) => (
            <TabButton
              key={key}
              label={label}
              count={tabCount(key)}
              active={tab === key}
              onClick={() => setTab(key)}
            />
          ))}
        </ScrollShadow>
      </div>

      <div className="min-h-[160px] px-[20px] py-[20px] max-sm:min-h-[120px] max-sm:px-[16px] max-sm:py-[16px]">
        {tab === "price" ? (
          price ? (
            <PriceRangeFilter
              min={price.min}
              max={price.max}
              histogram={histogram}
              valueMin={draft.priceMin}
              valueMax={draft.priceMax}
              onChange={(lo, hi) =>
                setDraft((prev) => ({ ...prev, priceMin: lo, priceMax: hi }))
              }
            />
          ) : (
            <p className="text-[13px] max-sm:text-[11px] text-gray-500">
              가격 정보를 불러오지 못했어요.
            </p>
          )
        ) : tab === "region" ? (
          <RegionFilter
            regions={regions ?? []}
            value={draft.region}
            onChange={(region) => setDraft((prev) => ({ ...prev, region }))}
          />
        ) : (
          <TagGroup
            aria-label={`${TABS.find((t) => t.key === tab)?.label ?? ""} 필터`}
            selectionMode="multiple"
            selectedKeys={new Set(draft[tab])}
            onSelectionChange={(keys) => {
              const next =
                keys === "all"
                  ? optionsByKey[tab].map((option) => option.value)
                  : [...keys].map(String);
              setDraft((prev) => ({ ...prev, [tab]: next }));
            }}
          >
            <TagGroup.List className="flex flex-wrap gap-[8px]">
              {optionsByKey[tab].map((option) => (
                <Tag
                  key={option.value}
                  id={option.value}
                  className={OPTION_TAG}
                >
                  {option.label}
                </Tag>
              ))}
            </TagGroup.List>
          </TagGroup>
        )}
      </div>

      <div className="flex items-center justify-between gap-[8px] border-t border-gray-200 px-[20px] py-[16px] max-sm:px-[16px] max-sm:py-[12px]">
        <Button
          variant="ghost"
          isDisabled={resetDisabled}
          onPress={() => {
            setDraft(EMPTY_MEDIA_FILTER);
            onReset();
          }}
          className="flex h-[40px] shrink-0 items-center gap-[8px] rounded-[16px] border border-gray-200 bg-white px-[16px] text-[14px] font-medium text-gray-700 hover:bg-gray-50 max-sm:gap-[6px] max-sm:px-[12px] max-sm:text-[11px]"
        >
          <RotateLeftIcon className="m-0 size-[18px] shrink-0 max-sm:size-[15px]" />
          {/* 모바일은 폭이 좁아 버튼 글자를 줄인다. */}
          <span className="max-sm:hidden">필터 초기화</span>
          <span className="sm:hidden">초기화</span>
        </Button>
        {/* 모서리는 (높이/2)-3px — 버튼 40px → 17px, 개수 칩 24px → 9px.
            여백 기준은 상하 8px(40px 높이에 24px 칩). 오른쪽은 칩이 자체 여백을 가져
            그대로 8px, 왼쪽은 글자가 바로 붙어 답답해 보여 14px로 조금 넓혔다. */}
        {/* 개수를 다시 세는 동안은 칩에 스피너를 띄우고 버튼을 잠근다(옛 개수로 적용되는 것 방지). */}
        <Button
          variant="ghost"
          isDisabled={counting}
          onPress={() => {
            onApply(draft);
            onClose();
          }}
          className="flex h-[40px] items-center gap-[10px] rounded-[17px] bg-primary pr-[8px] pl-[14px] text-[14px] font-bold text-white hover:bg-primary-600 data-[disabled=true]:opacity-70 data-[pressed=true]:bg-primary-600 max-sm:min-w-0 max-sm:flex-1 max-sm:justify-between max-sm:text-[11px]"
        >
          <span className="max-sm:hidden">선택한 필터로 결과 보기</span>
          <span className="sm:hidden">결과 보기</span>
          <Chip className="h-[24px] min-w-[48px] justify-center rounded-[9px] bg-white/25 px-[10px] text-[12px] max-sm:text-[10px] font-bold text-white">
            {counting || count == null ? (
              <Spinner size="sm" color="current" className="size-[14px]" />
            ) : (
              `${count.toLocaleString()}개`
            )}
          </Chip>
        </Button>
      </div>
    </div>
  );
}
