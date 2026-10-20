"use client";

import { ListBox, Select } from "@heroui/react";

import { SortIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// 고른 값은 목록 조회의 sort 파라미터로 그대로 넘긴다(백엔드 MEDIA_SORT_KEYS 와 같은 값).
// "비율이 높은 순"(성별·연령대 비율)은 뺐다 — 타겟 맞춤 추천은 AI 믹시로 유도한다.
// (백엔드 ratio-* 정렬은 남아 있다.)
const BASIC_SORTS = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
  { key: "priceDesc", label: "가격 높은 순" },
  { key: "priceAsc", label: "가격 낮은 순" },
] as const;

export type MediaSortKey = (typeof BASIC_SORTS)[number]["key"];

export const DEFAULT_MEDIA_SORT: MediaSortKey = "latest";

/** 관심 매체는 "최신순"이 최근에 담은 순이라 "최근순"으로 부른다. */
export const FAVORITE_LATEST_LABEL = "최근순";

/** 정렬 라벨. latestLabel: "최신순" 대신 쓸 이름(관심 매체는 FAVORITE_LATEST_LABEL). */
export function mediaSortLabel(
  key: MediaSortKey,
  latestLabel?: string,
): string {
  if (key === "latest" && latestLabel) return latestLabel;
  return BASIC_SORTS.find((sort) => sort.key === key)?.label ?? "";
}

/**
 * 상단 바의 정렬 Select — 버튼(트리거)은 상단 바의 회색 필 모양(triggerClassName)을 받고,
 * 누르면 아래로 옵션 목록이 열린다.
 */
export function MediaSortSelect({
  value,
  onChange,
  latestLabel,
  onOpenChange,
  triggerClassName,
  iconClassName,
}: {
  value: MediaSortKey;
  onChange: (next: MediaSortKey) => void;
  /** "최신순" 대신 쓸 이름 — 관심 매체는 "최근순". */
  latestLabel?: string;
  /** 열릴 때 필터 패널을 닫는 데 쓴다. */
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  iconClassName?: string;
}) {
  return (
    <Select
      aria-label="정렬"
      selectedKey={value}
      onOpenChange={onOpenChange}
      onSelectionChange={(key) => {
        if (key != null) onChange(key as MediaSortKey);
      }}
      className="min-w-0 shrink-0 max-sm:shrink"
    >
      {/* 필드 모양(최소 높이·그림자)을 풀고 상단 바 필 모양을 입힌다. */}
      <Select.Trigger
        className={cn(
          triggerClassName,
          "min-h-0 shadow-none data-[open=true]:bg-surface",
        )}
      >
        <SortIcon className={iconClassName} />
        <Select.Value className="min-w-0 text-[14px] font-medium whitespace-nowrap text-gray-900 max-sm:truncate max-sm:text-[12px]">
          {mediaSortLabel(value, latestLabel)}
        </Select.Value>
        <Select.Indicator className="static shrink-0 text-gray-500 max-sm:size-[14px]" />
      </Select.Trigger>
      <Select.Popover placement="bottom end" className="w-[260px]">
        <ListBox>
          {BASIC_SORTS.map((sort) => (
            <ListBox.Item
              key={sort.key}
              id={sort.key}
              textValue={mediaSortLabel(sort.key, latestLabel)}
            >
              {mediaSortLabel(sort.key, latestLabel)}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
