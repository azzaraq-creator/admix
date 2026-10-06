"use client";

import { ListBox, NumberField, Select } from "@heroui/react";

import type { MediaPlanOption } from "@/hooks/media";
import type { MediaDetailViewModel } from "./useMediaDetailViewModel";

/** 매체 정보 팝업에서 고르는 집행 옵션 — 상품(플랜)·개월 수·제작 수(OOH만). */
export type MediaOptionsValue = {
  /** null이면 첫 상품(기획안이 플랜을 안 고르면 쓰는 것과 같은 기본값). */
  planNo: number | null;
  months: number;
  productionCount: number;
};

export const DEFAULT_MEDIA_OPTIONS: MediaOptionsValue = {
  planNo: null,
  months: 1,
  productionCount: 1,
};

const MAX_MONTHS = 36;
const MAX_PRODUCTION_COUNT = 99;

/** 제작 수는 OOH(지면 등 실물 제작) 매체만 고른다 — DOOH(디지털)는 "OOH"로 시작하지 않는다. */
export function isOohMedia(oohType: string | null): boolean {
  return !!oohType && oohType.toUpperCase().startsWith("OOH");
}

/**
 * 상품 이름 — 영상 상품(DOOH)은 "영상 20초, 일 100회 송출", 영상이 아닌 상품(OOH 등
 * 영상 길이·송출 수가 둘 다 없음)은 상품명. 하나만 있으면 있는 쪽만 보여 준다.
 */
export function planSpecText(
  plan: Pick<MediaPlanOption, "exposureSeconds" | "dailyBroadcasts" | "title">,
): string {
  if (plan.exposureSeconds == null && plan.dailyBroadcasts == null) {
    return plan.title;
  }
  return [
    plan.exposureSeconds != null && `영상 ${plan.exposureSeconds}초`,
    plan.dailyBroadcasts != null &&
      `일 ${plan.dailyBroadcasts.toLocaleString()}회 송출`,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * 고른 옵션으로 계산한 금액 — 광고비 × 개월 수, 제작비 × 제작 수.
 * 기획안 금액 규칙(광고비 × 수량 × 개월 수, 제작비 × 수량 × 제작 수)과 같다(담을 때 수량은 1).
 */
export function mediaOptionTotals(
  vm: MediaDetailViewModel,
  value: MediaOptionsValue,
) {
  const plan =
    vm.planOptions.find((p) => p.planNo === value.planNo) ??
    vm.planOptions[0] ??
    null;
  const ooh = isOohMedia(vm.oohType);
  const adFee = plan ? plan.adFeeKrw : vm.adFeeKrw;
  const productionFee = plan ? plan.productionFeeKrw : vm.productionFeeKrw;
  // 제작비는 OOH(실물 제작)만 들고, 금액이 없으면 아예 보이지 않는다.
  const hasProduction = ooh && productionFee != null;
  const productionCount = hasProduction ? value.productionCount : 1;
  const adTotal = adFee == null ? null : adFee * value.months;
  const productionTotal = hasProduction
    ? productionFee * productionCount
    : null;
  return {
    plan,
    ooh,
    hasProduction,
    months: value.months,
    productionCount,
    adTotal,
    productionTotal,
    total:
      adTotal == null && productionTotal == null
        ? null
        : (adTotal ?? 0) + (productionTotal ?? 0),
  };
}

const won = (value: number | null) =>
  value == null ? "-" : `${value.toLocaleString()}원`;

/**
 * 가격 칸 + 옵션 — 옵션 칸을 따로 두지 않고 가격 칸 안에서 고른다.
 * 맨 위 상품(Select — 영상 길이·일 송출 수), 광고비 줄에 개월 수, 제작비 줄에 제작 수(OOH만),
 * 맨 아래 총 예상 비용.
 */
export function MediaOptionsPriceBox({
  vm,
  value,
  onChange,
}: {
  vm: MediaDetailViewModel;
  value: MediaOptionsValue;
  onChange: (next: MediaOptionsValue) => void;
}) {
  const totals = mediaOptionTotals(vm, value);

  return (
    <div className="flex w-full flex-col gap-[8px] rounded-[12px] border border-[#ececef] bg-[#f7f7f8] px-[12px] py-[10px]">
      {totals.plan && (
        <>
          <div className={ROW}>
            <span className={ROW_LABEL}>상품</span>
            <Select
              aria-label="상품"
              selectedKey={String(totals.plan.planNo)}
              onSelectionChange={(key) => {
                if (key != null) onChange({ ...value, planNo: Number(key) });
              }}
              className="min-w-0 flex-1"
            >
              {/* 칸 28px → 곡률 11px. 조절기와 같은 높이·테두리. */}
              <Select.Trigger className="h-[28px] min-h-0 w-full rounded-[11px] border border-[#ececef] bg-white py-0 ps-[10px] pe-[28px] shadow-none data-[hovered=true]:bg-white">
                <Select.Value className="truncate text-[12px] leading-[26px] font-medium text-[#18181b]">
                  {() => planSpecText(totals.plan!)}
                </Select.Value>
                <Select.Indicator className="end-[9px] size-[13px] text-[#71717a]" />
              </Select.Trigger>
              <Select.Popover className="min-w-[var(--trigger-width)]">
                <ListBox>
                  {vm.planOptions.map((p) => (
                    <ListBox.Item
                      key={p.planNo}
                      id={String(p.planNo)}
                      textValue={planSpecText(p)}
                    >
                      {/* 영상 길이·일 송출 수 (금액은 고르면 아래 광고비 줄에 보인다). */}
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b]">
                        {planSpecText(p)}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="h-px w-full bg-[#ececef]" />
        </>
      )}

      <div className={ROW}>
        <span className={ROW_LABEL}>광고비</span>
        <Stepper
          label="개월 수"
          unit="개월"
          value={value.months}
          max={MAX_MONTHS}
          onChange={(months) => onChange({ ...value, months })}
        />
        <span className={ROW_AMOUNT}>{won(totals.adTotal)}</span>
      </div>
      {/* 제작비 줄은 OOH이고 제작비가 있을 때만 — DOOH(디지털)·제작비 없음이면 뺀다. */}
      {totals.hasProduction && (
        <>
          <div className="h-px w-full bg-[#ececef]" />
          <div className={ROW}>
            <span className={ROW_LABEL}>제작비</span>
            <Stepper
              label="제작 수"
              unit="회"
              value={value.productionCount}
              max={MAX_PRODUCTION_COUNT}
              onChange={(productionCount) =>
                onChange({ ...value, productionCount })
              }
            />
            <span className={ROW_AMOUNT}>{won(totals.productionTotal)}</span>
          </div>
        </>
      )}
      <div className="h-px w-full bg-[#ececef]" />
      <div className="flex items-center justify-between whitespace-nowrap">
        <span className="text-[13px] font-bold text-[#18181b]">
          총 예상 비용
        </span>
        <span className="text-[17px] font-bold text-primary max-sm:text-[16px]">
          {won(totals.total)}
        </span>
      </div>
    </div>
  );
}

const ROW = "flex min-h-[28px] items-center gap-[10px]";
const ROW_LABEL =
  "w-[38px] shrink-0 text-[12px] font-semibold whitespace-nowrap text-[#a1a1aa]";
const ROW_AMOUNT =
  "min-w-0 flex-1 text-right text-[15px] font-bold whitespace-nowrap text-[#18181b] max-sm:text-[14px]";

// 조절기 28px → 곡률 11px, 양옆 −·+ 버튼은 칸 안에 붙인다.
export function Stepper({
  label,
  unit,
  value,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <NumberField
      aria-label={label}
      value={value}
      minValue={1}
      maxValue={max}
      step={1}
      // 지우고 비운 채 나가면 NaN이 온다 — 그때는 1로 되돌린다.
      onChange={(next) =>
        onChange(Number.isFinite(next) && next >= 1 ? next : 1)
      }
      className="shrink-0"
    >
      <NumberField.Group className="flex h-[28px] w-[104px] items-center rounded-[11px] border border-[#ececef] bg-white p-[2px] shadow-none">
        <NumberField.DecrementButton className="size-[22px] min-w-0 shrink-0 rounded-[9px] bg-transparent text-[#71717a] data-[disabled=true]:opacity-40 data-[hovered=true]:bg-[#f4f4f5] [&_svg]:size-[11px]" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-[1px]">
          <NumberField.Input className="w-[24px] min-w-0 bg-transparent p-0 text-right text-[12px] font-bold text-[#18181b] tabular-nums shadow-none outline-none" />
          <span className="text-[12px] font-medium text-[#71717a]">{unit}</span>
        </div>
        <NumberField.IncrementButton className="size-[22px] min-w-0 shrink-0 rounded-[9px] bg-transparent text-[#71717a] data-[disabled=true]:opacity-40 data-[hovered=true]:bg-[#f4f4f5] [&_svg]:size-[11px]" />
      </NumberField.Group>
    </NumberField>
  );
}
