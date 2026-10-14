"use client";

import { ListBox, Select } from "@heroui/react";
import { useRef, useState } from "react";

import { ChevronDownIcon, SortIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

// 고른 값은 목록 조회의 sort 파라미터로 그대로 넘긴다(백엔드 MEDIA_SORT_KEYS 와 같은 값).
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
/** "비율이 높은 순" 접기·펴기 줄의 키 — 정렬 값이 아니라 고르면 목록만 접고 편다. */
const RATIO_TOGGLE = "ratio-toggle";
/** 비율 정렬 보류 — 상세 팝업 인구(직접 입력 → 상권)와 정렬 기준(상권만)을 맞출 때까지 막아 둔다.
 *  true로 바꾸면 다시 고를 수 있다. */
const RATIO_SORT_ENABLED: boolean = false;

/** 관심 매체는 "최신순"이 최근에 담은 순이라 "최근순"으로 부른다. */
export const FAVORITE_LATEST_LABEL = "최근순";

/** 정렬 라벨. 비율 정렬은 기준을 붙인다(예: "30대 비율이 높은 순").
 *  latestLabel: "최신순" 대신 쓸 이름(관심 매체는 FAVORITE_LATEST_LABEL). */
export function mediaSortLabel(
  key: MediaSortKey,
  latestLabel?: string,
): string {
  if (key === "latest" && latestLabel) return latestLabel;
  const basic = BASIC_SORTS.find((sort) => sort.key === key);
  if (basic) return basic.label;
  const target = RATIO_TARGETS.find((t) => `${RATIO_PREFIX}${t.key}` === key);
  return `${target?.label ?? ""} 비율이 높은 순`;
}

/**
 * 상단 바의 정렬 Select — 버튼(트리거)은 상단 바의 회색 필 모양(triggerClassName)을 받고,
 * 누르면 아래로 옵션 목록이 열린다. 비율 정렬은 "비율이 높은 순" 줄을 펴서 기준(여성·20대…)을 고른다.
 * 이 줄은 처음엔 접혀 있고, 지금 비율 정렬 중이면 펴진 채로 열린다.
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
  const ratioTarget = RATIO_TARGETS.find(
    (t) => `${RATIO_PREFIX}${t.key}` === value,
  );
  const isRatio = ratioTarget != null;
  const [open, setOpen] = useState(false);
  const [ratioExpanded, setRatioExpanded] = useState(
    isRatio && RATIO_SORT_ENABLED,
  );
  // 접기·펴기 줄을 고르면 Select가 목록을 닫으려 하므로 그 한 번은 열어 둔다.
  const keepOpenRef = useRef(false);

  return (
    <Select
      aria-label="정렬"
      selectedKey={value}
      isOpen={open}
      onOpenChange={(next) => {
        if (!next && keepOpenRef.current) {
          keepOpenRef.current = false;
          return;
        }
        if (next) setRatioExpanded(isRatio && RATIO_SORT_ENABLED);
        setOpen(next);
        onOpenChange?.(next);
      }}
      onSelectionChange={(key) => {
        if (key === RATIO_TOGGLE) {
          keepOpenRef.current = true;
          setRatioExpanded((v) => !v);
          return;
        }
        if (key != null) onChange(key as MediaSortKey);
      }}
      className="min-w-0 shrink-0 max-sm:shrink"
    >
      {/* 필드 모양(최소 높이·그림자)을 풀고 상단 바 필 모양을 입힌다. */}
      <Select.Trigger
        className={cn(
          triggerClassName,
          "min-h-0 shadow-none data-[open=true]:bg-white",
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
          <ListBox.Item
            id={RATIO_TOGGLE}
            textValue="비율이 높은 순"
            aria-expanded={ratioExpanded}
            isDisabled={!RATIO_SORT_ENABLED}
            className="text-gray-500"
          >
            <span className="flex-1">
              비율이 높은 순
              {!RATIO_SORT_ENABLED && (
                <span className="ms-[6px] text-[12px]">준비 중</span>
              )}
              {/* 접혀 있어도 지금 고른 기준이 보이게. */}
              {ratioTarget && !ratioExpanded && (
                <span className="ms-[6px] font-medium text-primary">
                  {ratioTarget.label}
                </span>
              )}
            </span>
            <ChevronDownIcon
              className={cn(
                "size-[16px] shrink-0 transition-transform",
                ratioExpanded && "rotate-180",
              )}
            />
          </ListBox.Item>
          {ratioExpanded &&
            RATIO_TARGETS.map((target) => {
              const key: MediaSortKey = `${RATIO_PREFIX}${target.key}`;
              return (
                <ListBox.Item
                  key={key}
                  id={key}
                  textValue={mediaSortLabel(key)}
                  className="ps-[24px]"
                >
                  {target.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              );
            })}
        </ListBox>
        {/* 비율 정렬을 펴면 계산 방식을 함께 보여 준다(백엔드 _population_ratio 와 같은 기준). */}
        {ratioExpanded && (
          <p className="mx-[8px] mb-[8px] rounded-[10px] bg-gray-100 px-[12px] py-[10px] text-[12px] leading-[18px] break-keep text-gray-500">
            매체 주변 상권의 유동인구 중 고른 성별·연령대가 차지하는 비율이
            높은 순이에요. 성별은 남녀 합계, 연령대는 전체 유동인구 대비로
            계산해요. 서울시 상권 데이터(최근 분기) 기준이라, 데이터가 없는
            매체는 맨 뒤에 보여요.
          </p>
        )}
      </Select.Popover>
    </Select>
  );
}
