"use client";

import { Button, Chip, Spinner, Tag, TagGroup } from "@heroui/react";
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
import { useFixedMediaCount, type MediaFilterParams } from "@/hooks/media";
import { cn } from "@/lib/utils";

/** 시안(02. 매체 찾기 - 필터)의 탭 순서. `region`은 아직 백엔드 필터가 없다. */
type TabKey = FilterPanelKey | "region";

const TABS: { key: TabKey; label: string }[] = [
  { key: "region", label: "지역" },
  { key: "category", label: "카테고리" },
  { key: "price", label: "가격 범위" },
  { key: "oohType", label: "매체 타입" },
  { key: "saleType", label: "매체 판매 유형" },
  { key: "exposureType", label: "설치 장소" },
  { key: "mediaShape", label: "매체 형태" },
];

/** 패널 탭 모양 — 정렬 패널(MediaSortBar)의 Select 트리거도 같은 모양을 쓴다. */
export const TAB_BASE =
  "flex h-[38px] shrink-0 items-center gap-[8px] rounded-[16px] px-[20px] text-[14px] transition-colors";
// 선택된 탭의 테두리는 #9ca3af(= black-400).
export const TAB_ACTIVE =
  "border border-black-400 bg-white font-bold text-black-900";
export const TAB_IDLE =
  "bg-transparent font-medium text-black-500 hover:bg-transparent hover:text-black-900";

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
        disabled && "cursor-not-allowed opacity-40 hover:text-black-500",
      )}
    >
      {label}
      {count > 0 && (
        // 색은 지정하지 않고 탭 글자색(선택·hover 상태 포함)을 그대로 따른다.
        <span className="text-[13px] font-semibold">{count}</span>
      )}
    </Button>
  );
}

/** 두 필터 선택이 같은지(값 순서 무관). */
function sameFilter(a: MediaFilterState, b: MediaFilterState): boolean {
  return FILTER_DIMS.every((dim) => {
    if (dim.key === "price")
      return a.priceMin === b.priceMin && a.priceMax === b.priceMax;
    const x = [...a[dim.key]].sort().join("\u0000");
    const y = [...b[dim.key]].sort().join("\u0000");
    return x === y;
  });
}

// 패널에서 선택을 바꾼 뒤 개수를 다시 셀 때까지 기다리는 시간 — 가격 슬라이더를 끄는 동안
// 요청이 쏟아지지 않게 멈춘 뒤에만 조회한다.
const COUNT_DEBOUNCE_MS = 300;

/** 칩·가격 중 하나라도 걸려 있으면 true. FILTER_DIMS가 전 차원을 덮는다. */
function hasSelection(f: MediaFilterState): boolean {
  return FILTER_DIMS.some((dim) => dimSelectionCount(dim.key, f) > 0);
}

// 옵션 태그 — 높이 32px, 모서리는 (높이/2)-3px = 13px.
// 선택 시 테두리 #9ca3af(= black-400) + black-900 볼드. HeroUI Tag의 기본 배경·선택 색은
// bg-white로 덮는다(유틸리티 레이어가 컴포넌트 레이어보다 뒤에 와서 그대로 이긴다).
const OPTION_TAG = cn(
  "flex h-[32px] shrink-0 items-center rounded-[13px] border border-black-200 bg-white px-[14px] text-[13px] font-medium text-black-600 transition-colors",
  "hover:border-black-300",
  "data-[selected=true]:border-black-400 data-[selected=true]:font-bold data-[selected=true]:text-black-900",
);

export function MediaFilterPanel({
  value,
  optionsByKey,
  price,
  totalCount,
  scope,
  onApply,
  onReset,
  onClose,
}: {
  value: MediaFilterState;
  optionsByKey: Record<ChipDimKey, FilterOption[]>;
  price: PriceMeta;
  /** 이미 적용된 필터의 결과 수 — 패널 선택이 적용된 것과 같으면 다시 세지 않고 이 값을 쓴다. */
  totalCount: number;
  /** 필터 외 조회 조건(지도 영역·검색어). 패널 선택의 개수를 셀 때 함께 건다. */
  scope: Pick<MediaFilterParams, "neLat" | "swLat" | "neLng" | "swLng" | "keyword">;
  onApply: (next: MediaFilterState) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  // 패널 안에서만 쓰는 임시 상태 — "결과 보기"를 눌러야 URL(=조회)에 반영된다.
  const [draft, setDraft] = useState<MediaFilterState>(value);
  const [tab, setTab] = useState<TabKey>("category");

  // 선택이 멈추면 그 조건으로 결과 수를 다시 센다. 적용된 필터와 같으면 목록의 total을 그대로 쓴다.
  const [settledDraft, setSettledDraft] = useState(draft);
  useEffect(() => {
    const timer = setTimeout(() => setSettledDraft(draft), COUNT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft]);
  const sameAsApplied = sameFilter(settledDraft, value);
  const countQuery = useFixedMediaCount(
    { ...toChipFilterParams(settledDraft), ...scope },
    !sameAsApplied,
  );
  const counting =
    !sameFilter(draft, settledDraft) ||
    (!sameAsApplied && (countQuery.isFetching || countQuery.data == null));
  const count = sameAsApplied ? totalCount : countQuery.data;

  const tabCount = (key: TabKey) =>
    key === "region" ? 0 : dimSelectionCount(key, draft);

  // 되돌릴 게 없으면(패널에서 고른 것도, 이미 적용된 것도 없으면) 초기화를 잠근다.
  const resetDisabled = !hasSelection(draft) && !hasSelection(value);

  return (
    <div className="flex flex-col rounded-[20px] border border-black-200 bg-white shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-[4px] overflow-x-auto border-b border-black-200 px-[16px] py-[12px]">
        {TABS.map(({ key, label }) => (
          <TabButton
            key={key}
            label={label}
            count={tabCount(key)}
            active={tab === key}
            // TODO: 지역 필터는 백엔드 파라미터가 없어 아직 열 수 없다.
            disabled={key === "region"}
            onClick={() => setTab(key)}
          />
        ))}
      </div>

      <div className="min-h-[160px] px-[20px] py-[20px]">
        {tab === "price" ? (
          price ? (
            <PriceRangeFilter
              min={price.min}
              max={price.max}
              histogram={price.histogram}
              valueMin={draft.priceMin}
              valueMax={draft.priceMax}
              onChange={(lo, hi) =>
                setDraft((prev) => ({ ...prev, priceMin: lo, priceMax: hi }))
              }
            />
          ) : (
            <p className="text-[13px] text-black-500">
              가격 정보를 불러오지 못했어요.
            </p>
          )
        ) : tab === "region" ? (
          <p className="text-[13px] text-black-500">
            준비 중인 필터입니다. 상단 검색창에 지역명을 입력해 보세요.
          </p>
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

      <div className="flex items-center justify-between border-t border-black-200 px-[20px] py-[16px]">
        <Button
          variant="ghost"
          isDisabled={resetDisabled}
          onPress={() => {
            setDraft(EMPTY_MEDIA_FILTER);
            onReset();
          }}
          className="flex h-[40px] items-center gap-[8px] rounded-[16px] border border-black-200 bg-white px-[16px] text-[14px] font-medium text-black-700 hover:bg-black-50"
        >
          <RotateLeftIcon className="m-0 size-[18px] shrink-0" />
          필터 초기화
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
          className="flex h-[40px] items-center gap-[10px] rounded-[17px] bg-primary pr-[8px] pl-[14px] text-[14px] font-bold text-white hover:bg-primary-600 data-[disabled=true]:opacity-70 data-[pressed=true]:bg-primary-600"
        >
          선택한 필터로 결과 보기
          <Chip className="h-[24px] min-w-[48px] justify-center rounded-[9px] bg-white/25 px-[10px] text-[12px] font-bold text-white">
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
