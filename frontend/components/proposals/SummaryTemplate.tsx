"use client";

import { useState, type ReactNode } from "react";

import { CalendarIcon } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ProposalDetail, ProposalItem } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

import { SlideScaler } from "./SlideScaler";

const COL = {
  no: 84,
  type: 168,
  region: 168,
  media: 219,
  product: 219,
  qty: 126,
  ad: 218,
  prod: 218,
  total: 218,
  date: 202,
} as const;

const EMPTY = "-";
const ROWS_PER_PAGE = 5; // 한 서머리 슬라이드에 들어가는 매체 행 수 (표 영역을 균등 분할)

function formatNumber(value: number | null): string {
  if (value == null) return EMPTY;
  return value.toLocaleString("ko-KR");
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

// 수량 기본값 1 — 미입력(null)·0 은 1 로 간주해 금액 계산에 사용
function effectiveQty(quantity: number | null | undefined): number {
  return quantity && quantity > 0 ? quantity : 1;
}

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[46px]">
      <div className="w-[2px] shrink-0 self-stretch bg-stroke" />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-[9px] text-[32px] leading-[1.4] tracking-[-0.8px] text-white [word-break:break-word]">
        <p className="font-medium">{label}</p>
        <p className="w-full font-bold">{value}</p>
      </div>
    </div>
  );
}

function Cell({
  width,
  children,
  pad = "py-[16px]",
}: {
  width: number;
  children: ReactNode;
  pad?: string;
}) {
  return (
    <div
      style={{ width }}
      className={`flex items-center justify-center px-[24px] ${pad}`}
    >
      <p className="text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454] [word-break:break-word]">
        {children}
      </p>
    </div>
  );
}

function BoxedCell({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div
      style={{ width }}
      className="flex items-center justify-center px-[24px] py-[8px]"
    >
      <div className="flex w-full items-center justify-center rounded-[8px] border border-stroke px-[16px] py-[8px]">
        <p className="whitespace-nowrap text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454]">
          {children}
        </p>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full min-w-0 bg-transparent text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454] outline-none placeholder:text-placeholder";

function QuantityCell({
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
  return (
    <div
      style={{ width }}
      className="flex items-center justify-center px-[24px] py-[8px]"
    >
      <div className="flex w-full items-center justify-center rounded-[8px] border border-stroke px-[16px] py-[8px]">
        <input
          type="text"
          inputMode="numeric"
          placeholder="1"
          readOnly={!interactive}
          value={value == null ? "" : String(value)}
          aria-label="수량"
          onChange={(event) =>
            onChange?.(event.target.value.replace(/[^0-9]/g, ""))
          }
          className={INPUT_CLASS}
        />
      </div>
    </div>
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

const DATE_BOX =
  "flex w-full items-center justify-center gap-[10px] rounded-[8px] border border-stroke px-[16px] py-[8px]";
const DATE_TEXT =
  "flex-1 text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px]";

function DateInput({
  interactive,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  interactive: boolean;
  value?: string | null;
  onChange?: (value: string) => void;
  minDate?: string | null; // 이 날짜 이전 비활성(종료일 등)
  maxDate?: string | null; // 이 날짜 이후 비활성(시작일 등)
}) {
  const [open, setOpen] = useState(false);

  const label = (
    <>
      <span className={cn(DATE_TEXT, value ? "text-[#545454]" : "text-placeholder")}>
        {value || "YYYY.MM.DD"}
      </span>
      <CalendarIcon className="size-[20px] shrink-0 text-[#545454]" />
    </>
  );

  if (!interactive) {
    return <div className={DATE_BOX}>{label}</div>;
  }

  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const min = parseDate(minDate);
  // 하한 = 오늘과 minDate 중 더 늦은 날(항상 오늘 이후만 선택 가능).
  const floor = min && min > today ? min : today;
  const max = parseDate(maxDate);
  const disabled = [
    { before: floor },
    ...(max ? [{ after: max }] : []),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={cn(DATE_BOX, "outline-none")} aria-label="날짜 선택">
        {label}
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          mode="single"
          defaultMonth={selected ?? floor}
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange?.(toDateStr(d));
            setOpen(false);
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

const HEADER_COLUMNS: { label: string; width: number }[] = [
  { label: "NO", width: COL.no },
  { label: "구분", width: COL.type },
  { label: "지역", width: COL.region },
  { label: "매체명", width: COL.media },
  { label: "상품명", width: COL.product },
  { label: "수량", width: COL.qty },
  { label: "광고비", width: COL.ad },
  { label: "제작비", width: COL.prod },
  { label: "합계", width: COL.total },
  { label: "시작일/종료일", width: COL.date },
];

export function SummaryTemplate({
  proposal,
  rows,
  startIndex,
  interactive = false,
  onDateChange,
  onQuantityChange,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  interactive?: boolean;
  onDateChange?: (
    mediaId: string,
    field: "start_date" | "end_date",
    value: string,
  ) => void;
  onQuantityChange?: (mediaId: string, value: string) => void;
}) {
  const items = proposal.items;
  const adTotal = items.reduce(
    (sum, item) => sum + (item.price ?? 0) * effectiveQty(item.quantity),
    0,
  );
  const prodTotal = items.reduce(
    (sum, item) => sum + (item.production_fee ?? 0) * effectiveQty(item.quantity),
    0,
  );
  // GROSS 는 기존 정의(광고비 합계, 제작비 제외)를 유지하되 수량을 반영해 실시간 계산
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
    <div className="flex h-[1080px] w-[1920px] flex-col overflow-hidden bg-white">
      <div className="flex shrink-0 flex-col items-start bg-primary px-[80px] py-[40px]">
        <div className="flex w-full items-center gap-[48px]">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[31px] whitespace-nowrap text-white">
            <p className="text-[80px] font-bold leading-none tracking-[-2px]">
              Summary
            </p>
            <div className="flex w-[154px] flex-col items-start gap-[9px] text-[32px] leading-[1.4] tracking-[-0.8px]">
              <p className="font-medium">캠페인 기간</p>
              <p className="font-bold">{period}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
            <HeaderStat label="집행 매체" value={items.length} />
            <HeaderStat label="캠페인 지역" value={regions || EMPTY} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
            <HeaderStat label="광고비 합계" value={formatWon(adTotal)} />
            <HeaderStat label="제작비 합계" value={formatWon(prodTotal)} />
          </div>

          <div className="flex items-center self-stretch">
            <div className="flex h-full items-center gap-[46px]">
              <div className="h-full w-[2px] shrink-0 bg-stroke" />
              <div className="flex flex-col items-start gap-[9px] text-white">
                <p className="whitespace-nowrap text-[32px] font-medium leading-[1.4] tracking-[-0.8px]">
                  전체 금액 합계(GROSS) *VAT 별도
                </p>
                <p className="text-[54px] font-bold leading-[1.4] tracking-[-1.35px]">
                  {formatWon(grossTotal)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-[40px] pt-[24px]">
        <div className="flex w-full items-center bg-grey-50">
          {HEADER_COLUMNS.map((column) => (
            <Cell key={column.label} width={column.width}>
              {column.label}
            </Cell>
          ))}
        </div>

        {rows.map((item, index) => {
          const qty = effectiveQty(item.quantity);
          return (
          <div
            key={item.media_id}
            className="flex w-full min-h-0 flex-1 items-center overflow-hidden border-b border-stroke py-[16px]"
          >
            <Cell width={COL.no}>{startIndex + index + 1}</Cell>
            <Cell width={COL.type}>{item.category ?? EMPTY}</Cell>
            <Cell width={COL.region}>{item.region ?? EMPTY}</Cell>
            <Cell width={COL.media}>{item.name ?? EMPTY}</Cell>
            <Cell width={COL.product}>{item.product ?? EMPTY}</Cell>
            <QuantityCell
              width={COL.qty}
              interactive={interactive}
              value={interactive ? item.quantity : qty}
              onChange={(value) => onQuantityChange?.(item.media_id, value)}
            />
            <BoxedCell width={COL.ad}>
              {formatNumber(item.price == null ? null : item.price * qty)}
            </BoxedCell>
            <BoxedCell width={COL.prod}>
              {formatNumber(
                item.production_fee == null ? null : item.production_fee * qty,
              )}
            </BoxedCell>
            <Cell width={COL.total} pad="py-[8px]">
              {formatNumber(
                ((item.price ?? 0) + (item.production_fee ?? 0)) * qty,
              )}
            </Cell>
            <div
              style={{ width: COL.date }}
              className="flex flex-col items-center justify-center gap-[10px] px-[24px] py-[8px]"
            >
              <DateInput
                interactive={interactive}
                value={item.start_date}
                maxDate={item.end_date}
                onChange={(value) =>
                  onDateChange?.(item.media_id, "start_date", value)
                }
              />
              <DateInput
                interactive={interactive}
                value={item.end_date}
                minDate={item.start_date}
                onChange={(value) =>
                  onDateChange?.(item.media_id, "end_date", value)
                }
              />
            </div>
          </div>
          );
        })}
        {Array.from({ length: Math.max(0, ROWS_PER_PAGE - rows.length) }).map(
          (_, i) => (
            <div
              key={`filler-${i}`}
              className="w-full flex-1 border-b border-stroke"
            />
          ),
        )}
      </div>
    </div>
  );
}

export function SummarySlide({
  proposal,
  rows,
  startIndex,
  zoom,
  interactive = true,
  onDateChange,
  onQuantityChange,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  zoom: number;
  interactive?: boolean;
  onDateChange?: (
    mediaId: string,
    field: "start_date" | "end_date",
    value: string,
  ) => void;
  onQuantityChange?: (mediaId: string, value: string) => void;
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
        onDateChange={onDateChange}
        onQuantityChange={onQuantityChange}
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
    <SlideScaler className="absolute inset-0" contentClassName="pointer-events-none">
      <SummaryTemplate proposal={proposal} rows={rows} startIndex={startIndex} />
    </SlideScaler>
  );
}
