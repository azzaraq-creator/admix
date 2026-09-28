"use client";

import { ListBox, Select } from "@heroui/react";

import { cn } from "@/lib/utils";

import { TAB_ACTIVE, TAB_BASE, TAB_IDLE, TabButton } from "./MediaFilterPanel";

// TODO: 백엔드 /media/fixed에 정렬 파라미터가 없다. 지금은 화면 안에서만 고를 수 있고
// 리스트 순서는 바뀌지 않는다 — API가 생기면 고른 값을 조회 쿼리로 넘긴다.
const BASIC_SORTS = [
  { key: "latest", label: "최신순" },
  { key: "popular", label: "인기순" },
  { key: "priceDesc", label: "가격 높은 순" },
  { key: "priceAsc", label: "가격 낮은 순" },
] as const;

/** "비율이 높은 순"의 기준 — 시안(02. 매체 찾기 - 정렬 (비율))의 옵션 순서. */
const RATIO_TARGETS = [
  { key: "female", label: "여성" },
  { key: "male", label: "남성" },
  { key: "age10", label: "10대" },
  { key: "age20", label: "20대" },
  { key: "age30", label: "30대" },
  { key: "age40", label: "40대" },
  { key: "age50", label: "50대" },
  { key: "age60", label: "60대 이상" },
] as const;

type RatioTarget = (typeof RATIO_TARGETS)[number]["key"];

export type MediaSortKey =
  (typeof BASIC_SORTS)[number]["key"] | `ratio-${RatioTarget}`;

export const DEFAULT_MEDIA_SORT: MediaSortKey = "latest";

const RATIO_PREFIX = "ratio-";

/** 상단 정렬 버튼 라벨. 비율 정렬은 기준을 붙인다(예: "30대 비율이 높은 순"). */
export function mediaSortLabel(key: MediaSortKey): string {
  const basic = BASIC_SORTS.find((sort) => sort.key === key);
  if (basic) return basic.label;
  const target = RATIO_TARGETS.find((t) => `${RATIO_PREFIX}${t.key}` === key);
  return `${target?.label ?? ""} 비율이 높은 순`;
}

/**
 * 정렬 패널 — 필터 패널(MediaFilterPanel)과 같은 카드·탭 모양.
 * 기본 정렬 탭은 누르는 즉시 적용되고, 마지막 "비율이 높은 순"은 탭 모양의 Select라
 * 누르면 기준 목록이 바로 열린다.
 */
export function MediaSortBar({
  value,
  onChange,
}: {
  value: MediaSortKey;
  onChange: (next: MediaSortKey) => void;
}) {
  const ratioTarget = value.startsWith(RATIO_PREFIX)
    ? value.slice(RATIO_PREFIX.length)
    : null;

  return (
    <div className="flex flex-col rounded-[20px] border border-black-200 bg-white shadow-[0px_8px_24px_0px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-[4px] overflow-x-auto px-[16px] py-[12px]">
        {BASIC_SORTS.map((sort) => (
          <TabButton
            key={sort.key}
            label={sort.label}
            count={0}
            active={value === sort.key}
            onClick={() => onChange(sort.key)}
          />
        ))}

        <Select
          aria-label="비율이 높은 순"
          placeholder="비율이 높은 순"
          selectedKey={ratioTarget}
          onSelectionChange={(key) => {
            if (key != null) onChange(`${RATIO_PREFIX}${key as RatioTarget}`);
          }}
          className="shrink-0"
        >
          {/* 필드 모양(최소 높이·테두리·배경·그림자)을 풀고 옆 탭과 같은 모양으로 맞춘다.
              화살표(Select.Indicator)가 오른쪽 안쪽에 앉으므로 오른쪽 여백만 넓힌다. */}
          <Select.Trigger
            className={cn(
              TAB_BASE,
              "min-h-0 py-0 pe-[36px] shadow-none",
              ratioTarget
                ? cn(TAB_ACTIVE, "hover:bg-white")
                : cn(TAB_IDLE, "border-transparent"),
            )}
          >
            <Select.Value className="text-[14px] text-current data-[placeholder=true]:text-current">
              {({ selectedText, isPlaceholder }) =>
                isPlaceholder
                  ? "비율이 높은 순"
                  : `${selectedText} 비율이 높은 순`
              }
            </Select.Value>
            <Select.Indicator className="end-[12px] text-current" />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {RATIO_TARGETS.map((target) => (
                <ListBox.Item
                  key={target.key}
                  id={target.key}
                  textValue={target.label}
                >
                  {target.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
}
