"use client";

import { ListBox, NumberField, Select } from "@heroui/react";

import type { MediaPlanOption } from "@/hooks/media";
import { formatAdFee } from "@/lib/media";
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
 * 상품 이름 — 영상 상품(DOOH)은 "영상 20초", 영상 길이가 없는 상품(OOH 등)은 상품명.
 * 일 송출 수는 매체 정보 "일 송출 수" 칸에 따로 보인다.
 */
export function planSpecText(
  plan: Pick<MediaPlanOption, "exposureSeconds" | "title">,
): string {
  return plan.exposureSeconds != null
    ? `영상 ${plan.exposureSeconds}초`
    : plan.title;
}

/**
 * 상품 고르기 칸의 이름 — 보통은 planSpecText. 같은 매체의 상품끼리 그 이름이 겹치면(패키지와 단품 면처럼
 * 영상 길이가 같은 상품) 구분이 안 되므로 상품명을 앞에 붙인다.
 */
export function planOptionLabel(
  plan: Pick<MediaPlanOption, "exposureSeconds" | "title">,
  all: Pick<MediaPlanOption, "exposureSeconds" | "title">[],
): string {
  const spec = planSpecText(plan);
  const same = all.filter((p) => planSpecText(p) === spec).length;
  return same > 1 && plan.title !== spec
    ? `${shortPlanTitle(plan.title)} · ${spec}`
    : spec;
}

/**
 * 상품 고르기 칸에 붙일 짧은 상품명 — 패키지 이름 "디지털 가로변쉘터 Half A PKG"는 칸에 비해 길어
 * 구분되는 끝부분 "A PKG"만 쓴다. 그 밖의 상품명은 그대로.
 */
function shortPlanTitle(title: string): string {
  const pkg = title.match(/\b([A-Z])\s*PKG$/);
  return pkg ? `${pkg[1]} PKG` : title;
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
    // 광고비가 없으면(별도 문의) 총액도 알 수 없다.
    total: adTotal == null ? null : adTotal + (productionTotal ?? 0),
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
    <div className="flex w-full flex-col gap-[8px] rounded-[12px] border border-tone-ececef bg-tone-f7f7f8 px-[12px] py-[10px]">
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
              {/* 옵션 칸은 모두 32px(곡률 13px) · 13px 글자로 맞춘다 — 기본 최소 높이·위아래 여백을 풀어야 이 높이에 들어간다. */}
              <Select.Trigger className="h-[32px] min-h-0 w-full items-center rounded-[13px] py-0 text-[13px]">
                <Select.Value className="truncate text-[13px]">
                  {() => planOptionLabel(totals.plan!, vm.planOptions)}
                </Select.Value>
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover className="min-w-[var(--trigger-width)]">
                <ListBox>
                  {vm.planOptions.map((p) => (
                    <ListBox.Item
                      key={p.planNo}
                      id={String(p.planNo)}
                      textValue={planOptionLabel(p, vm.planOptions)}
                    >
                      {/* 영상 길이·일 송출 수 (금액은 고르면 아래 광고비 줄에 보인다). */}
                      <span className="min-w-0 flex-1 truncate">
                        {planOptionLabel(p, vm.planOptions)}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
          <div className="h-px w-full bg-tone-ececef" />
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
        <span className={ROW_AMOUNT}>{formatAdFee(totals.adTotal)}</span>
      </div>
      {/* 제작비 줄은 OOH이고 제작비가 있을 때만 — DOOH(디지털)·제작비 없음이면 뺀다. */}
      {totals.hasProduction && (
        <>
          <div className="h-px w-full bg-tone-ececef" />
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
      <div className="h-px w-full bg-tone-ececef" />
      <div className="flex items-center justify-between whitespace-nowrap">
        <span className="text-[13px] font-bold text-zinc-900">
          총 예상 비용
        </span>
        <span className="text-[17px] font-bold text-primary max-sm:text-[16px]">
          {formatAdFee(totals.total)}
        </span>
      </div>
    </div>
  );
}

const ROW = "flex min-h-[32px] items-center gap-[10px]";
const ROW_LABEL =
  "w-[38px] shrink-0 text-[12px] font-semibold whitespace-nowrap text-zinc-400";
const ROW_AMOUNT =
  "min-w-0 flex-1 text-right text-[15px] font-bold whitespace-nowrap text-zinc-900 max-sm:text-[14px]";

// 조절기 32px → 곡률 13px. 상품 Select와 같은 높이 · 글자 크기, 양옆 −·+ 버튼은 32px 정사각형.
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
      {/* 양쪽 버튼(32px씩) 사이 가운데에 "숫자 + 단위"를 붙여 둔다(예: 1개월).
          숫자 칸은 자릿수만큼만 넓혀 단위와 함께 정확히 가운데에 오게 하고, −·+ 아이콘은 글자(13px)에 맞춰 14px. */}
      <NumberField.Group className="h-[32px] w-[132px] rounded-[13px] text-[13px] font-medium">
        <NumberField.DecrementButton className="w-[32px] [&_svg]:size-[14px]" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-[1px]">
          <NumberField.Input
            style={{ width: `${Math.max(String(value).length, 1) + 0.2}ch` }}
            className="h-full min-w-0 px-0 text-center text-[13px] font-medium"
          />
          <span className="shrink-0">{unit}</span>
        </div>
        <NumberField.IncrementButton className="w-[32px] [&_svg]:size-[14px]" />
      </NumberField.Group>
    </NumberField>
  );
}
