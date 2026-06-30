"use client";

import { useState } from "react";

import { ChevronDownIcon, RotateCwIcon } from "@/components/icons";

import {
  EMPTY_FIXED_FILTER,
  FILTER_DIMS,
  dimSelectionCount,
  type ChipDimKey,
  type FilterOption,
  type FilterPanelKey,
  type FixedFilterState,
} from "./filterConfig";
import { PriceRangeFilter } from "./PriceRangeFilter";

type PriceMeta = { min: number; max: number; histogram: number[] } | null;

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-white p-[3px] text-[9px] font-semibold leading-[12px] text-primary">
      {count}
    </span>
  );
}

export function MediaSearchFilter({
  value,
  onChange,
  optionsByKey,
  price,
}: {
  value: FixedFilterState;
  onChange: (next: FixedFilterState) => void;
  optionsByKey: Record<ChipDimKey, FilterOption[]>;
  price: PriceMeta;
}) {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<FilterPanelKey>("category");

  const chipOptions = (key: ChipDimKey): FilterOption[] => optionsByKey[key];

  // 가격은 선택이 아니라 범위 설정 → 전체(최저~최대)가 아닐 때만 활성.
  const priceActive =
    price != null
      ? (value.priceMin != null && value.priceMin > price.min) ||
        (value.priceMax != null && value.priceMax < price.max)
      : value.priceMin != null || value.priceMax != null;

  const toggleChip = (key: ChipDimKey, optValue: string) => {
    const cur = value[key];
    const next = cur.includes(optValue)
      ? cur.filter((v) => v !== optValue)
      : [...cur, optValue];
    onChange({ ...value, [key]: next });
  };

  const reset = () => onChange(EMPTY_FIXED_FILTER);

  const openWith = (key: FilterPanelKey) => {
    setActiveKey(key);
    setOpen(true);
  };

  if (!open) {
    return (
      <div className="flex items-center gap-[16px] border-b border-stroke py-[12px]">
        <div className="flex flex-1 items-center gap-[6px] overflow-x-auto px-[16px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={reset}
            className="flex shrink-0 items-center gap-[4px] rounded-[8px] bg-platinum-100 px-[12px] py-[8px] text-sm font-medium text-[#2f3442]"
          >
            <RotateCwIcon className="size-[20px] text-primary" />
            초기화
          </button>
          {FILTER_DIMS.map(({ key, label }) => {
            const isPrice = key === "price";
            const count = isPrice ? 0 : dimSelectionCount(key, value);
            const active = isPrice ? priceActive : count > 0;
            return (
              <button
                key={key}
                type="button"
                onClick={() => openWith(key)}
                className={`flex shrink-0 items-center gap-[4px] whitespace-nowrap rounded-[8px] px-[12px] py-[8px] text-sm font-medium ${
                  active
                    ? "bg-primary text-white"
                    : "bg-platinum-100 text-[#2f3442]"
                }`}
              >
                {label}
                {count > 0 && <CountBadge count={count} />}
              </button>
            );
          })}
        </div>
        <div className="pr-[16px]">
          <button
            type="button"
            aria-label="필터 펼치기"
            onClick={() => setOpen(true)}
            className="flex items-center rounded-full border border-stroke p-[6px] text-black"
          >
            <ChevronDownIcon className="size-[24px]" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] border-b border-stroke bg-white pt-[12px] drop-shadow-[0px_4px_2px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-[6px] px-[16px] py-[2px]">
        {[0, 2, 4].map((start) => (
          <div key={start} className="flex gap-[6px]">
            {FILTER_DIMS.slice(start, start + 2).map(({ key, label }) => {
              const isPrice = key === "price";
              const count = isPrice ? 0 : dimSelectionCount(key, value);
              // 현재 보는 필터이거나, 안에 선택한 요소가 있으면 활성 유지
              const active =
                activeKey === key || (isPrice ? priceActive : count > 0);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveKey(key)}
                  className={`flex flex-1 items-center justify-center gap-[4px] rounded-[8px] px-[12px] py-[8px] text-sm font-medium ${
                    active
                      ? "bg-primary text-white"
                      : "bg-platinum-100 text-[#2f3442]"
                  }`}
                >
                  {label}
                  {count > 0 && <CountBadge count={count} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {activeKey === "price" ? (
        price ? (
          <PriceRangeFilter
            min={price.min}
            max={price.max}
            histogram={price.histogram}
            valueMin={value.priceMin}
            valueMax={value.priceMax}
            onChange={(lo, hi) =>
              onChange({ ...value, priceMin: lo, priceMax: hi })
            }
          />
        ) : (
          <p className="px-[16px] py-[8px] text-sm text-[#757575]">
            가격 정보를 불러오는 중...
          </p>
        )
      ) : (
        <div className="flex flex-wrap content-start items-start gap-[8px] px-[16px]">
          {chipOptions(activeKey).map((opt) => {
            const selected = value[activeKey].includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleChip(activeKey, opt.value)}
                className={`flex items-center justify-center gap-[4px] rounded-full px-[12px] py-[6px] text-base font-medium ${
                  selected
                    ? "bg-primary text-white"
                    : "bg-platinum-100 text-[#2f3442]"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
          {chipOptions(activeKey).length === 0 && (
            <p className="py-[8px] text-sm text-[#757575]">옵션이 없습니다.</p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between bg-grey-50 px-[16px] py-[12px]">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-[4px] rounded-[8px] border border-primary bg-white px-[12px] py-[8px] text-sm font-medium text-primary"
        >
          <RotateCwIcon className="size-[18px] text-primary" />
          초기화
        </button>
        <button
          type="button"
          aria-label="필터 접기"
          onClick={() => setOpen(false)}
          className="flex items-center rounded-full border border-stroke p-[6px] text-black"
        >
          <ChevronDownIcon className="size-[24px] rotate-180" />
        </button>
      </div>
    </div>
  );
}
