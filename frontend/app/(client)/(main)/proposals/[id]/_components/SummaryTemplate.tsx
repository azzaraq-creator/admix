"use client";

import { type ReactNode } from "react";

import { CalendarIcon } from "@/components/icons";
import type { ProposalDetail, ProposalItem } from "@/hooks/proposals";

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

function formatNumber(value: number | null): string {
  if (value == null) return EMPTY;
  return value.toLocaleString("ko-KR");
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

function HeaderStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex w-full items-start gap-[46px]">
      <div className="w-[2px] shrink-0 self-stretch bg-[#e4e5ee]" />
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
      <div className="flex w-full items-center justify-center rounded-[8px] border border-[#e4e5ee] px-[16px] py-[8px]">
        <p className="whitespace-nowrap text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454]">
          {children}
        </p>
      </div>
    </div>
  );
}

const INPUT_CLASS =
  "w-full min-w-0 bg-transparent text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454] outline-none placeholder:text-[#c9cad3]";

function QuantityCell({
  width,
  interactive,
}: {
  width: number;
  interactive: boolean;
}) {
  return (
    <div
      style={{ width }}
      className="flex items-center justify-center px-[24px] py-[8px]"
    >
      <div className="flex w-full items-center justify-center rounded-[8px] border border-[#e4e5ee] px-[16px] py-[8px]">
        <input
          type="text"
          inputMode="numeric"
          placeholder="0"
          readOnly={!interactive}
          aria-label="수량"
          onInput={(event) => {
            event.currentTarget.value = event.currentTarget.value.replace(
              /[^0-9]/g,
              "",
            );
          }}
          className={INPUT_CLASS}
        />
      </div>
    </div>
  );
}

function DateInput({ interactive }: { interactive: boolean }) {
  return (
    <div className="flex w-full items-center justify-center gap-[10px] rounded-[8px] border border-[#e4e5ee] px-[16px] py-[8px]">
      <input
        type="text"
        placeholder="YYYY.MM.DD"
        readOnly={!interactive}
        aria-label="날짜"
        className={INPUT_CLASS}
      />
      <CalendarIcon className="size-[20px] shrink-0 text-[#545454]" />
    </div>
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
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  interactive?: boolean;
}) {
  const items = proposal.items;
  const adTotal = items.reduce((sum, item) => sum + (item.price ?? 0), 0);

  return (
    <div className="flex h-[1080px] w-[1920px] flex-col overflow-hidden bg-white">
      <div className="flex flex-col items-start bg-[#00aaa4] px-[80px] py-[40px]">
        <div className="flex w-full items-center gap-[48px]">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-[31px] whitespace-nowrap text-white">
            <p className="text-[80px] font-bold leading-none tracking-[-2px]">
              Summary
            </p>
            <div className="flex w-[154px] flex-col items-start gap-[9px] text-[32px] leading-[1.4] tracking-[-0.8px]">
              <p className="font-medium">캠페인 기간</p>
              <p className="font-bold">{EMPTY}</p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
            <HeaderStat label="집행 매체" value={items.length} />
            <HeaderStat label="캠페인 지역" value={EMPTY} />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start gap-[18px]">
            <HeaderStat label="광고비 합계" value={formatWon(adTotal)} />
            <HeaderStat label="제작비 합계" value={EMPTY} />
          </div>

          <div className="flex items-center self-stretch">
            <div className="flex h-full items-center gap-[46px]">
              <div className="h-full w-[2px] shrink-0 bg-[#e4e5ee]" />
              <div className="flex flex-col items-start gap-[9px] text-white">
                <p className="whitespace-nowrap text-[32px] font-medium leading-[1.4] tracking-[-0.8px]">
                  전체 금액 합계(GROSS) *VAT 별도
                </p>
                <p className="text-[54px] font-bold leading-[1.4] tracking-[-1.35px]">
                  {formatWon(proposal.total_amount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-[40px] pt-[24px]">
        <div className="flex w-full items-center bg-[#f6f6f6]">
          {HEADER_COLUMNS.map((column) => (
            <Cell key={column.label} width={column.width}>
              {column.label}
            </Cell>
          ))}
        </div>

        {rows.map((item, index) => (
          <div
            key={item.media_id}
            className="flex w-full items-center border-b border-[#e4e5ee] py-[16px]"
          >
            <Cell width={COL.no}>{startIndex + index + 1}</Cell>
            <Cell width={COL.type}>{item.category ?? EMPTY}</Cell>
            <Cell width={COL.region}>{item.region ?? EMPTY}</Cell>
            <Cell width={COL.media}>{item.name ?? EMPTY}</Cell>
            <Cell width={COL.product}>{item.product ?? EMPTY}</Cell>
            <QuantityCell width={COL.qty} interactive={interactive} />
            <BoxedCell width={COL.ad}>{formatNumber(item.price)}</BoxedCell>
            <BoxedCell width={COL.prod}>{EMPTY}</BoxedCell>
            <Cell width={COL.total} pad="py-[8px]">
              {formatNumber(item.price)}
            </Cell>
            <div
              style={{ width: COL.date }}
              className="flex flex-col items-center justify-center gap-[10px] px-[24px] py-[8px]"
            >
              <DateInput interactive={interactive} />
              <DateInput interactive={interactive} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SummarySlide({
  proposal,
  rows,
  startIndex,
  zoom,
}: {
  proposal: ProposalDetail;
  rows: ProposalItem[];
  startIndex: number;
  zoom: number;
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
        interactive
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
