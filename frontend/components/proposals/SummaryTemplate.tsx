"use client";

import {
  Calendar,
  DateField,
  DatePicker,
  I18nProvider,
  ListBox,
  NumberField,
  Select,
} from "@heroui/react";
import {
  getLocalTimeZone,
  parseDate as parseCalendarDate,
  today as calendarToday,
  type CalendarDate,
} from "@internationalized/date";
import type { ReactNode } from "react";

import { CalendarIcon } from "@/components/icons";
import type {
  PlanOption,
  ProposalDetail,
  ProposalItem,
} from "@/hooks/proposals";
import { cn } from "@/lib/utils";

import { SlideScaler } from "./SlideScaler";
import { SlideWatermark } from "./SlideWatermark";

// 좌우 여백 64px 을 뺀 표 너비(1792px)에 맞춘 열 너비
const COL = {
  no: 64,
  type: 130,
  region: 110,
  media: 220,
  product: 230,
  months: 170,
  ad: 160,
  prod: 170,
  total: 170,
  period: 368,
} as const;

const EMPTY = "-";
const ROWS_PER_PAGE = 5; // 한 서머리 슬라이드에 들어가는 매체 행 수 (표 영역을 균등 분할)
const MAX_MONTHS = 36; // 개월 수 최대값 — 매체 정보 팝업(MediaOptions)과 같다
const MAX_PRODUCTION_COUNT = 99; // 제작 수 최대값 — 매체 정보 팝업과 같다

function formatNumber(value: number | null): string {
  if (value == null) return EMPTY;
  return value.toLocaleString("ko-KR");
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

// 수량·개월 수·제작 수 기본값 1 — 미입력(null)·0 은 1 로 간주해 금액 계산에 사용
export function effectiveQty(quantity: number | null | undefined): number {
  return quantity && quantity > 0 ? quantity : 1;
}

// 금액 규칙(백엔드 기획안 합계·PPT와 같다): 광고비 × 수량 × 개월 수, 제작비 × 수량 × 제작 수.
// 수량은 화면에서 입력받지 않아 항상 1이다(예전 값 호환용으로 계산에만 남김).
export function adAmount(item: ProposalItem): number | null {
  if (item.price == null) return null;
  return item.price * effectiveQty(item.quantity) * effectiveQty(item.months);
}

export function productionAmount(item: ProposalItem): number | null {
  if (item.production_fee == null) return null;
  return (
    item.production_fee *
    effectiveQty(item.quantity) *
    effectiveQty(item.production_count)
  );
}

// "YYYY.MM.DD"(점) 또는 "YYYY-MM-DD"(대시) 모두 허용해 Date 로 파싱
function parseDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(`${s.replace(/\./g, "-")}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// 서머리 표시 형식(lib/date 와 동일한 점 구분)으로 저장
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// 저장 형식("YYYY.MM.DD") ↔ HeroUI DatePicker 값(CalendarDate)
function toCalendarDate(s?: string | null): CalendarDate | null {
  if (!s) return null;
  try {
    return parseCalendarDate(s.replace(/\./g, "-"));
  } catch {
    return null;
  }
}

function fromCalendarDate(d: CalendarDate): string {
  return `${d.year}.${String(d.month).padStart(2, "0")}.${String(d.day).padStart(2, "0")}`;
}

/**
 * 시작일 + 개월 수 → 종료일(시작일 기준 N개월 뒤의 전날).
 * 예: 10.07 + 1개월 → 11.06, 10.01 + 1개월 → 10.31. 그 달에 없는 날이면 말일로 맞춘다(01.31 + 1개월 → 02.28).
 */
export function campaignEndDate(
  startDate: string | null | undefined,
  months: number | null | undefined,
): string | null {
  const start = parseDate(startDate);
  if (!start) return null;
  const year = start.getFullYear();
  const month = start.getMonth() + effectiveQty(months);
  const day = start.getDate() - 1;
  if (day === 0) return toDateStr(new Date(year, month, 0));
  const lastDay = new Date(year, month + 1, 0).getDate();
  return toDateStr(new Date(year, month, Math.min(day, lastDay)));
}

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[10px] border-l border-stroke px-[28px] first:border-l-0 first:pl-0">
      <p className="text-[16px] font-medium leading-[1.4] tracking-[-0.4px] text-gray-500">
        {label}
      </p>
      <p className="truncate text-[24px] font-semibold leading-[1.4] tracking-[-0.6px] text-gray-900 tabular-nums">
        {value}
      </p>
    </div>
  );
}

const CELL_TEXT =
  "text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-gray-700 [word-break:break-word]";

type Align = "left" | "center" | "right";

const ALIGN: Record<Align, { box: string; text: string }> = {
  left: { box: "justify-start", text: "text-left" },
  center: { box: "justify-center", text: "text-center" },
  right: { box: "justify-end", text: "text-right" },
};

// 합계 열은 연보라 바탕으로 머리글부터 마지막 행까지 이어 강조한다.
const TOTAL_COLUMN = "self-stretch bg-primary-50/70";

function Cell({
  width,
  children,
  align = "center",
  className,
  boxClassName,
}: {
  width: number;
  children: ReactNode;
  align?: Align;
  className?: string;
  boxClassName?: string;
}) {
  return (
    <div
      style={{ width }}
      className={cn(
        "flex shrink-0 items-center px-[20px]",
        ALIGN[align].box,
        boxClassName,
      )}
    >
      <p className={cn(ALIGN[align].text, CELL_TEXT, className)}>{children}</p>
    </div>
  );
}

// 구분(매체 분류) — 작은 칩으로 표시
function CategoryCell({
  width,
  value,
}: {
  width: number;
  value?: string | null;
}) {
  if (!value) return <Cell width={width}>{EMPTY}</Cell>;
  return (
    <div
      style={{ width }}
      className="flex shrink-0 items-center justify-center px-[12px]"
    >
      <span className="rounded-full bg-gray-100 px-[14px] py-[6px] text-center text-[15px] font-semibold leading-[1.3] tracking-[-0.375px] text-gray-600 [word-break:break-word]">
        {value}
      </span>
    </div>
  );
}

// 금액 — 입력 칸이 아니므로 테두리 없이 숫자만. note 는 제작 수처럼 곱한 값을 알리는 작은 글씨.
function AmountCell({
  width,
  children,
  note,
  strong = false,
}: {
  width: number;
  children: ReactNode;
  note?: string;
  strong?: boolean;
}) {
  return (
    <div
      style={{ width }}
      className={cn(
        "flex shrink-0 flex-col items-end justify-center px-[20px]",
        strong && TOTAL_COLUMN,
      )}
    >
      <p
        className={cn(
          "whitespace-nowrap tabular-nums",
          CELL_TEXT,
          strong && "font-bold text-primary-800",
        )}
      >
        {children}
      </p>
      {note && (
        <p className="whitespace-nowrap text-[14px] font-medium leading-[1.4] text-gray-400">
          {note}
        </p>
      )}
    </div>
  );
}

// 입력 칸 공통 모양 — 기획안 패널·문의 창과 같은 ADMIX 입력칸(옅은 회색 칸 + 1px 회색 테두리, 그림자 없음,
// 올리거나 입력 중이면 흰 바탕, 입력 중엔 1px 보라 테두리). 46px → 곡률 19px(높이의 약 0.42배).
const FIELD_BOX =
  "flex h-[46px] min-h-0 items-center rounded-[19px] border border-[#ececef] bg-[#f7f7f8] shadow-none transition-colors hover:bg-white data-[hovered=true]:bg-white focus-within:border-focus focus-within:bg-white data-[focus-within=true]:border-focus data-[focus-within=true]:bg-white";
// 입력 칸 안의 작은 버튼(−·+·달력) — 칸 곡률에 맞춰 동그랗게.
const FIELD_BUTTON =
  "flex size-[34px] min-w-0 shrink-0 items-center justify-center rounded-full bg-transparent p-0 text-[#71717a] data-[disabled=true]:opacity-40 data-[hovered=true]:bg-gray-100 data-[hovered=true]:text-gray-900";

function planLabel(plan: PlanOption): string {
  return (
    plan.product_display_name ?? plan.product_name ?? `상품 ${plan.plan_no}`
  );
}

// 상품(플랜) 고르기 — HeroUI Select. 서머리 표와 매체 슬라이드가 같이 쓴다.
export function PlanSelect({
  plans,
  current,
  onChange,
}: {
  plans: PlanOption[];
  current: PlanOption;
  onChange?: (planNo: number) => void;
}) {
  return (
    <Select
      aria-label="상품"
      selectedKey={String(current.plan_no)}
      onSelectionChange={(key) => {
        if (key != null) onChange?.(Number(key));
      }}
      className="w-full min-w-0"
    >
      <Select.Trigger
        className={cn(FIELD_BOX, "w-full py-0 ps-[14px] pe-[40px]")}
      >
        {/* 고른 항목의 목록 모양(작은 글씨) 대신 칸 크기에 맞춘 글자로 보여 준다. */}
        <Select.Value className="truncate text-left text-[18px] font-semibold leading-[1.4] tracking-[-0.45px] text-gray-900">
          {() => planLabel(current)}
        </Select.Value>
        <Select.Indicator className="end-[14px] size-[18px] text-[#71717a]" />
      </Select.Trigger>
      <Select.Popover className="min-w-[var(--trigger-width)]">
        <ListBox>
          {plans.map((plan) => (
            <ListBox.Item
              key={plan.plan_no}
              id={String(plan.plan_no)}
              textValue={planLabel(plan)}
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#18181b]">
                {planLabel(plan)}
              </span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

// 상품명 — 고를 상품이 2개 이상일 때만 Select, 아니면 글자만.
function ProductCell({
  width,
  interactive,
  item,
  onChange,
}: {
  width: number;
  interactive: boolean;
  item: ProposalItem;
  onChange?: (planNo: number) => void;
}) {
  const plans = item.plans ?? [];
  if (!interactive || plans.length <= 1) {
    return (
      <Cell width={width} align="left">
        {item.product ?? EMPTY}
      </Cell>
    );
  }
  const current =
    plans.find((plan) => plan.plan_no === item.selected_plan_no) ?? plans[0];
  return (
    <div style={{ width }} className="flex shrink-0 items-center px-[12px]">
      <PlanSelect plans={plans} current={current} onChange={onChange} />
    </div>
  );
}

// 숫자 입력(개월 수·제작 수) — −·+ 버튼과 직접 입력. 비우고 나가면 1로 되돌린다.
// compact 는 제작비 칸처럼 금액 아래에 붙는 작은 크기.
function CountField({
  label,
  unit,
  value,
  max,
  compact = false,
  onChange,
}: {
  label: string;
  unit: string;
  value?: number | null;
  max: number;
  compact?: boolean;
  onChange?: (value: number) => void;
}) {
  const button = cn(
    FIELD_BUTTON,
    compact ? "size-[28px] [&_svg]:size-[12px]" : "[&_svg]:size-[14px]",
  );
  return (
    <NumberField
      aria-label={label}
      value={effectiveQty(value)}
      minValue={1}
      maxValue={max}
      step={1}
      onChange={(next) =>
        onChange?.(Number.isFinite(next) && next >= 1 ? next : 1)
      }
      className="w-full"
    >
      <NumberField.Group
        className={cn(
          FIELD_BOX,
          "w-full px-[4px]",
          compact && "h-[38px] rounded-[16px] px-[3px]",
        )}
      >
        <NumberField.DecrementButton className={button} />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-[2px]">
          <NumberField.Input
            className={cn(
              "w-[28px] min-w-0 bg-transparent p-0 text-right font-semibold text-gray-900 tabular-nums shadow-none outline-none",
              compact ? "text-[16px]" : "text-[18px]",
            )}
          />
          <span
            className={cn(
              "font-medium text-gray-500",
              compact ? "text-[14px]" : "text-[15px]",
            )}
          >
            {unit}
          </span>
        </div>
        <NumberField.IncrementButton className={button} />
      </NumberField.Group>
    </NumberField>
  );
}

function MonthsCell({
  width,
  interactive,
  value,
  onChange,
}: {
  width: number;
  interactive: boolean;
  value?: number | null;
  onChange?: (value: string) => void;
}) {
  if (!interactive) {
    return <Cell width={width}>{`${effectiveQty(value)}개월`}</Cell>;
  }
  return (
    <div
      style={{ width }}
      className="flex shrink-0 items-center justify-center px-[12px]"
    >
      <CountField
        label="개월 수"
        unit="개월"
        value={value}
        max={MAX_MONTHS}
        onChange={(next) => onChange?.(String(next))}
      />
    </div>
  );
}

// 제작비 — 금액 아래에 제작 수. 제작비가 있는 매체만 편집 칸을 두고(디지털 매체 등 제작비가 없으면 "-"),
// 읽기전용이면 제작 수가 2회 이상일 때만 작은 글씨로 알린다.
function ProductionCell({
  width,
  interactive,
  item,
  onChange,
}: {
  width: number;
  interactive: boolean;
  item: ProposalItem;
  onChange?: (value: number) => void;
}) {
  const count = effectiveQty(item.production_count);
  if (!interactive || item.production_fee == null) {
    return (
      <AmountCell
        width={width}
        note={count > 1 ? `제작 ${count}회` : undefined}
      >
        {formatNumber(productionAmount(item))}
      </AmountCell>
    );
  }
  return (
    <div
      style={{ width }}
      className="flex shrink-0 flex-col items-end justify-center gap-[8px] px-[12px]"
    >
      <p className={cn("whitespace-nowrap pr-[8px] tabular-nums", CELL_TEXT)}>
        {formatNumber(productionAmount(item))}
      </p>
      <CountField
        label="제작 수"
        unit="회"
        value={item.production_count}
        max={MAX_PRODUCTION_COUNT}
        compact
        onChange={onChange}
      />
    </div>
  );
}

// 시작일 — 직접 입력(연·월·일 칸) 또는 달력에서 선택. 오늘 이후만 고를 수 있다.
function StartDatePicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange?: (value: string) => void;
}) {
  const minDate = calendarToday(getLocalTimeZone());
  return (
    <I18nProvider locale="ko-KR">
      <DatePicker
        aria-label="시작일"
        value={toCalendarDate(value)}
        minValue={minDate}
        onChange={(date) => {
          // 직접 입력한 날짜가 오늘 이전이면 저장하지 않는다(칸은 HeroUI가 오류 상태로 표시).
          if (date && date.compare(minDate) >= 0) {
            onChange?.(fromCalendarDate(date));
          }
        }}
        className="w-[204px] shrink-0"
      >
        <DateField.Group
          className={cn(FIELD_BOX, "w-full gap-[4px] ps-[14px] pe-[5px]")}
        >
          <DateField.Input className="min-w-0 flex-1 text-[18px] font-semibold tracking-[-0.45px] text-gray-900 tabular-nums">
            {(segment) => (
              <DateField.Segment
                segment={segment}
                className="rounded-[4px] px-[1px] data-[placeholder=true]:font-medium data-[placeholder=true]:text-placeholder data-[focused=true]:bg-primary-100 data-[focused=true]:text-primary-800"
              />
            )}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger aria-label="달력 열기" className={FIELD_BUTTON}>
              <CalendarIcon className="size-[18px]" />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <DatePicker.Popover>
          {/* DatePicker 의 minValue 가 안쪽 달력까지 내려가지 않아 달력에도 직접 넣는다. */}
          <Calendar aria-label="시작일" minValue={minDate}>
            <Calendar.Header>
              <Calendar.Heading />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    </I18nProvider>
  );
}

// 집행 기간 — 시작일만 입력, 종료일은 개월 수로 자동 계산되는 표시 전용 값.
function PeriodCell({
  width,
  interactive,
  startDate,
  endDate,
  onStartChange,
}: {
  width: number;
  interactive: boolean;
  startDate?: string | null;
  endDate?: string | null;
  onStartChange?: (value: string) => void;
}) {
  if (!interactive) {
    return (
      <Cell width={width} className="whitespace-nowrap tabular-nums">
        {startDate ? `${startDate} ~ ${endDate ?? EMPTY}` : EMPTY}
      </Cell>
    );
  }
  return (
    <div
      style={{ width }}
      className="flex shrink-0 items-center justify-center gap-[10px] px-[12px]"
    >
      <StartDatePicker value={startDate} onChange={onStartChange} />
      <span className="text-[18px] text-gray-400">~</span>
      <span
        className={cn(
          "w-[106px] whitespace-nowrap text-[18px] font-medium leading-[1.4] tracking-[-0.45px] tabular-nums",
          endDate ? "text-gray-700" : "text-gray-400",
        )}
      >
        {endDate || "종료 일자"}
      </span>
    </div>
  );
}

// 글자는 왼쪽, 금액은 오른쪽, 짧은 값은 가운데 정렬
const HEADER_COLUMNS: {
  label: string;
  width: number;
  align?: Align;
  editable?: boolean;
  total?: boolean;
}[] = [
  { label: "NO", width: COL.no },
  { label: "구분", width: COL.type },
  { label: "지역", width: COL.region },
  { label: "매체명", width: COL.media, align: "left" },
  { label: "상품명", width: COL.product, align: "left", editable: true },
  { label: "개월 수", width: COL.months, editable: true },
  { label: "광고비", width: COL.ad, align: "right" },
  { label: "제작비", width: COL.prod, align: "right", editable: true },
  { label: "합계", width: COL.total, align: "right", total: true },
  { label: "집행 기간", width: COL.period, editable: true },
];

export function SummaryTemplate({
  proposal,
  rows,
  startIndex,
  interactive = false,
  onPlanChange,
  onStartDateChange,
  onMonthsChange,
  onProductionCountChange,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  interactive?: boolean;
  onPlanChange?: (mediaId: string, planNo: number) => void;
  onStartDateChange?: (mediaId: string, value: string) => void;
  onMonthsChange?: (mediaId: string, value: string) => void;
  onProductionCountChange?: (mediaId: string, value: number) => void;
}) {
  const items = proposal.items;
  const adTotal = items.reduce((sum, item) => sum + (adAmount(item) ?? 0), 0);
  const prodTotal = items.reduce(
    (sum, item) => sum + (productionAmount(item) ?? 0),
    0,
  );
  // GROSS 는 기존 정의(광고비 합계, 제작비 제외)를 유지하되 개월 수를 반영해 실시간 계산
  const grossTotal = adTotal;
  const regions = Array.from(
    new Set(
      items
        .map((item) => item.region)
        .filter((region): region is string => Boolean(region)),
    ),
  ).join(", ");
  const starts = items
    .map((item) => item.start_date)
    .filter((date): date is string => Boolean(date));
  const ends = items
    .map((item) => item.end_date)
    .filter((date): date is string => Boolean(date));
  const period =
    starts.length > 0 && ends.length > 0
      ? `${starts.reduce((a, b) => (a < b ? a : b))} ~ ${ends.reduce((a, b) => (a > b ? a : b))}`
      : EMPTY;

  return (
    <div className="relative flex h-[1080px] w-[1920px] flex-col overflow-hidden bg-white px-[64px] pb-[48px] pt-[56px]">
      <div className="flex shrink-0 items-center gap-[16px]">
        <span className="h-[36px] w-[6px] rounded-full bg-primary" />
        <p className="text-[40px] font-bold leading-none tracking-[-1px] text-gray-900">
          Summary
        </p>
        <p className="pt-[6px] text-[18px] font-medium leading-none tracking-[-0.45px] text-gray-400">
          캠페인 요약
        </p>
      </div>

      <div className="mt-[32px] flex shrink-0 gap-[20px]">
        <div className="grid min-w-0 flex-1 grid-cols-[1.5fr_0.7fr_1.2fr_1fr_1fr] items-center rounded-[16px] bg-gray-50 px-[36px] py-[28px]">
          <HeaderStat label="캠페인 기간" value={period} />
          <HeaderStat label="집행 매체" value={`${items.length}개`} />
          <HeaderStat label="캠페인 지역" value={regions || EMPTY} />
          <HeaderStat label="광고비 합계" value={formatWon(adTotal)} />
          <HeaderStat label="제작비 합계" value={formatWon(prodTotal)} />
        </div>
        <div className="flex w-[400px] shrink-0 flex-col justify-center gap-[10px] rounded-[16px] bg-primary px-[36px] py-[28px] text-white">
          <p className="whitespace-nowrap text-[16px] font-medium leading-[1.4] tracking-[-0.4px] text-white/75">
            전체 금액 합계(GROSS) · VAT 별도
          </p>
          <p className="truncate text-[36px] font-bold leading-[1.2] tracking-[-0.9px] tabular-nums">
            {formatWon(grossTotal)}
          </p>
        </div>
      </div>

      <div className="mt-[40px] flex min-h-0 flex-1 flex-col">
        <div className="flex h-[56px] w-full shrink-0 items-center border-b border-t-2 border-b-gray-200 border-t-gray-900">
          {HEADER_COLUMNS.map((column) => (
            <Cell
              key={column.label}
              width={column.width}
              align={column.align}
              boxClassName={column.total ? TOTAL_COLUMN : undefined}
              className={cn(
                "whitespace-nowrap text-[15px] font-semibold tracking-[-0.375px] text-gray-500",
                column.total && "text-primary-700",
                interactive && column.editable && "text-primary-600",
              )}
            >
              {column.label}
            </Cell>
          ))}
        </div>

        {rows.map((item, index) => (
          <div
            key={item.media_id}
            className="flex min-h-0 w-full flex-1 items-center overflow-hidden border-b border-gray-100"
          >
            <Cell width={COL.no} className="text-gray-400 tabular-nums">
              {startIndex + index + 1}
            </Cell>
            <CategoryCell width={COL.type} value={item.category} />
            <Cell width={COL.region}>{item.region ?? EMPTY}</Cell>
            <Cell
              width={COL.media}
              align="left"
              className="font-semibold text-gray-900"
            >
              {item.media_name ?? item.name ?? EMPTY}
            </Cell>
            <ProductCell
              width={COL.product}
              interactive={interactive}
              item={item}
              onChange={(planNo) => onPlanChange?.(item.media_id, planNo)}
            />
            <MonthsCell
              width={COL.months}
              interactive={interactive}
              value={item.months}
              onChange={(value) => onMonthsChange?.(item.media_id, value)}
            />
            <AmountCell width={COL.ad}>
              {formatNumber(adAmount(item))}
            </AmountCell>
            <ProductionCell
              width={COL.prod}
              interactive={interactive}
              item={item}
              onChange={(value) =>
                onProductionCountChange?.(item.media_id, value)
              }
            />
            <AmountCell width={COL.total} strong>
              {formatNumber(
                (adAmount(item) ?? 0) + (productionAmount(item) ?? 0),
              )}
            </AmountCell>
            <PeriodCell
              width={COL.period}
              interactive={interactive}
              startDate={item.start_date}
              endDate={item.end_date}
              onStartChange={(value) =>
                onStartDateChange?.(item.media_id, value)
              }
            />
          </div>
        ))}
        {Array.from({ length: Math.max(0, ROWS_PER_PAGE - rows.length) }).map(
          (_, i) => (
            <div key={`filler-${i}`} className="w-full flex-1" />
          ),
        )}
      </div>
      <SlideWatermark />
    </div>
  );
}

export function SummarySlide({
  proposal,
  rows,
  startIndex,
  zoom,
  interactive = true,
  onPlanChange,
  onStartDateChange,
  onMonthsChange,
  onProductionCountChange,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  zoom: number;
  interactive?: boolean;
  onPlanChange?: (mediaId: string, planNo: number) => void;
  onStartDateChange?: (mediaId: string, value: string) => void;
  onMonthsChange?: (mediaId: string, value: string) => void;
  onProductionCountChange?: (mediaId: string, value: number) => void;
}) {
  return (
    <SlideScaler
      style={{ width: `${zoom}%` }}
      className="relative aspect-[1920/1080] shrink-0 rounded-[8px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <SummaryTemplate
        proposal={proposal}
        rows={rows}
        startIndex={startIndex}
        interactive={interactive}
        onPlanChange={onPlanChange}
        onStartDateChange={onStartDateChange}
        onMonthsChange={onMonthsChange}
        onProductionCountChange={onProductionCountChange}
      />
    </SlideScaler>
  );
}

export function SummaryThumb({
  proposal,
  rows,
  startIndex,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
}) {
  return (
    <SlideScaler
      className="absolute inset-0"
      contentClassName="pointer-events-none"
    >
      <SummaryTemplate
        proposal={proposal}
        rows={rows}
        startIndex={startIndex}
      />
    </SlideScaler>
  );
}
