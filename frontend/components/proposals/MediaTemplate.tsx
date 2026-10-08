"use client";

import type { ReactNode } from "react";

import { StaticKakaoMap } from "@/components/common/StaticKakaoMap";
import type { PlanOption, ProposalItem } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

import { SlideScaler } from "./SlideScaler";
import { SlideWatermark } from "./SlideWatermark";
import {
  adAmount,
  effectiveQty,
  PlanSelect,
  productionAmount,
} from "./SummaryTemplate";

const EMPTY = "-";

function formatWon(value: number | null): string {
  if (value == null) return EMPTY;
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatQuantity(device: number | null, surface: number | null): string {
  const parts = [
    device != null ? `${device}기` : null,
    surface != null ? `${surface}면` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : EMPTY;
}

// 송출 조건 — "영상 20초 · 일 100회"
function formatBroadcast(plan: PlanOption | null): string {
  const parts = [
    plan?.exposure_seconds ? `영상 ${plan.exposure_seconds}초` : null,
    plan?.daily_broadcasts
      ? `일 ${plan.daily_broadcasts.toLocaleString("ko-KR")}회`
      : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : EMPTY;
}

function planLabel(plan: PlanOption | null | undefined): string | null {
  if (!plan) return null;
  return (
    plan.product_display_name ?? plan.product_name ?? `옵션 ${plan.plan_no}`
  );
}

function Chip({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full px-[14px] py-[6px] text-[15px] font-semibold leading-[1.3] tracking-[-0.375px]",
        accent ? "bg-primary-50 text-primary-700" : "bg-gray-100 text-gray-600",
      )}
    >
      {children}
    </span>
  );
}

// 매체 정보 사양표의 한 줄 — 왼쪽 항목명, 오른쪽 값. 맨 위 두 칸(첫 줄)은 진한 선을 긋는다.
function SpecRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[64px] min-w-0 items-center gap-[16px] border-b border-gray-100 [&:nth-child(-n+2)]:border-t-2 [&:nth-child(-n+2)]:border-t-gray-900">
      <p className="w-[104px] shrink-0 text-[16px] font-medium leading-[1.4] tracking-[-0.4px] text-gray-500">
        {label}
      </p>
      <div className="min-w-0 flex-1 truncate text-[18px] font-semibold leading-[1.4] tracking-[-0.45px] text-gray-900">
        {children}
      </div>
    </div>
  );
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-nowrap text-[18px] font-bold leading-[1.4] tracking-[-0.45px] text-gray-900">
      {children}
    </p>
  );
}

function PriceRow({
  label,
  note,
  value,
}: {
  label: string;
  note: string | null;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-[16px]">
      <p className="whitespace-nowrap text-[16px] font-medium leading-[1.4] text-white/75">
        {label}
        {note && (
          <span className="ml-[8px] text-[14px] text-white/55">{note}</span>
        )}
      </p>
      <p className="whitespace-nowrap text-[20px] font-semibold leading-[1.4] tabular-nums text-white">
        {value}
      </p>
    </div>
  );
}

function PriceCard({ item }: { item: ProposalItem }) {
  const ad = adAmount(item);
  const prod = productionAmount(item);
  const months = effectiveQty(item.months);
  const count = effectiveQty(item.production_count);
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col rounded-[16px] bg-primary p-[28px] text-white">
      <p className="text-[16px] font-medium leading-[1.4] tracking-[-0.4px] text-white/75">
        집행 금액 · VAT 별도
      </p>
      <div className="mt-[14px] flex flex-col gap-[8px]">
        <PriceRow
          label="광고비"
          note={
            item.price != null
              ? `${formatWon(item.price)} × ${months}개월`
              : null
          }
          value={formatWon(ad)}
        />
        <PriceRow
          label="제작비"
          note={
            item.production_fee != null
              ? `${formatWon(item.production_fee)} × ${count}회`
              : null
          }
          value={formatWon(prod)}
        />
      </div>
      <div className="mt-auto flex items-end justify-between border-t border-white/20 pt-[16px]">
        <p className="text-[18px] font-semibold leading-[1.4] text-white/85">
          합계
        </p>
        <p className="whitespace-nowrap text-[36px] font-bold leading-[1.2] tracking-[-0.9px] tabular-nums">
          {formatWon((ad ?? 0) + (prod ?? 0))}
        </p>
      </div>
    </div>
  );
}

// 매체 사진 — 비율이 제각각이라 자르지 않고 전체를 보여 주고, 남는 칸은 같은 사진을 흐리게 깔아 채운다.
function MediaPhoto({ url }: { url: string | null }) {
  if (!url) {
    return (
      <div className="flex size-full items-center justify-center bg-gray-50 text-[18px] font-medium text-gray-400">
        이미지 없음
      </div>
    );
  }
  return (
    <div className="relative size-full bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        aria-hidden
        className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-[40px]"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" className="relative size-full object-contain" />
    </div>
  );
}

type FactRow = { label: string; value: ReactNode };

// 오른쪽 칸 크기(px) — 본문 높이 841, 폭 908. 아래 지도·금액 칸은 380 이 기본이고 설명이 길면 260 까지 준다.
const RIGHT_W = 908;
const BODY_H = 841;
const BOTTOM_MAX = 380;
const BOTTOM_MIN = 260;

// 대략적인 글자 폭 — 한글은 글자 크기, 영문·숫자는 그보다 좁게(백엔드 PPT 의 _text_width 와 같다).
function textWidth(text: string, size: number): number {
  let w = 0;
  for (const ch of text) {
    if (ch >= "\uac00" && ch <= "\ud7a3") w += size;
    else if (ch === " ") w += size * 0.3;
    else if (/[A-Z0-9]/.test(ch)) w += size * 0.62;
    else w += size * 0.52;
  }
  return w;
}

// 단어 단위 줄바꿈을 따라 해 본 줄 수(keep-all).
function wrapLines(text: string, width: number, size: number): number {
  let lines = 0;
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (textWidth(candidate, size) <= width) {
      line = candidate;
      continue;
    }
    if (line) lines += 1;
    line = "";
    for (const ch of word) {
      if (line && textWidth(line + ch, size) > width) {
        lines += 1;
        line = "";
      }
      line += ch;
    }
  }
  return lines + (line ? 1 : 0);
}

/**
 * 설명 글자 크기 — 설명은 자르지 않고 다 보여 준다. 설명이 길면 아래 지도·금액 칸이 최소 높이까지 줄고,
 * 그래도 넘치면 글자를 18 → 16 → 14 로 줄인다(PPT 와 같은 규칙).
 */
function descriptionSize(description: string, factCount: number): number {
  const table = 25 + 14 + Math.ceil(factCount / 2) * 64;
  for (const size of [18, 16]) {
    const lines = Math.max(3, wrapLines(description, RIGHT_W, size));
    if (BODY_H - 24 - (lines * size * 1.6 + 32 + table) >= BOTTOM_MIN) {
      return size;
    }
  }
  return 14;
}

/**
 * 매체 종류별 매체 정보 — DOOH(디지털 화면)는 규격·해상도·운영 시간·송출 조건·소재 형식,
 * OOH(인쇄·고정물)는 제작 수. 이동 매체는 운행 지역·노선을 더한다.
 */
function mediaFacts(
  item: ProposalItem,
  plan: PlanOption | null,
  product: ReactNode,
): FactRow[] {
  const isMoving = item.media_source === "MOVING";
  const place: FactRow[] = isMoving
    ? [
        { label: "운행 지역", value: item.operating_area ?? EMPTY },
        { label: "운행 노선", value: item.operating_route ?? EMPTY },
      ]
    : [];
  const quantity: FactRow = {
    label: "수량",
    value: formatQuantity(item.device_quantity, item.surface_quantity),
  };
  if (item.ooh_type === "DOOH") {
    const operationTime =
      plan?.operation_start_time && plan?.operation_end_time
        ? `${plan.operation_start_time} ~ ${plan.operation_end_time}`
        : (item.operation ?? EMPTY);
    // 규격과 해상도는 한 칸에 — "12 × 6 m · 1920 × 1080 px"
    const size =
      [item.spec, item.resolution].filter(Boolean).join(" · ") || EMPTY;
    return [
      { label: "상품", value: product },
      { label: "규격 · 해상도", value: size },
      quantity,
      { label: "운영 시간", value: operationTime },
      { label: "송출 조건", value: formatBroadcast(plan) },
      { label: "소재 형식", value: item.material_formats ?? EMPTY },
      ...place,
    ];
  }
  return [
    { label: "상품", value: product },
    { label: "규격", value: item.spec ?? EMPTY },
    quantity,
    ...place,
    { label: "제작 수", value: `${effectiveQty(item.production_count)}회` },
  ];
}

export function MediaTemplate({
  item,
  plans,
  selectedPlanNo,
  onPlanChange,
  mapEnabled = true,
}: {
  item: ProposalItem;
  plans?: PlanOption[];
  selectedPlanNo?: number | null;
  onPlanChange?: (planNo: number) => void;
  mapEnabled?: boolean;
}) {
  const isMoving = item.media_source === "MOVING";
  const location = (isMoving ? item.operating_area : item.address) ?? null;
  const chips = [item.category, item.ooh_type].filter(
    (value): value is string => Boolean(value),
  );
  const hasCoords = item.latitude != null && item.longitude != null;

  const planList = plans ?? item.plans;
  const currentPlan =
    planList.find(
      (plan) => plan.plan_no === (selectedPlanNo ?? item.selected_plan_no),
    ) ??
    planList[0] ??
    null;
  const period = item.start_date
    ? `${item.start_date} ~ ${item.end_date ?? EMPTY}`
    : "시작일 미정";
  const product =
    planList.length > 1 && currentPlan && onPlanChange ? (
      <PlanSelect
        plans={planList}
        current={currentPlan}
        onChange={onPlanChange}
      />
    ) : (
      (item.product ?? planLabel(currentPlan) ?? EMPTY)
    );
  const facts = mediaFacts(item, currentPlan, product);
  const descSize = descriptionSize(item.description ?? "", facts.length);

  return (
    // 아래 여백을 넉넉히(72px) 둬 오른쪽 아래 워터마크가 금액 카드와 겹치지 않게 한다.
    <div className="relative flex h-[1080px] w-[1920px] flex-col overflow-hidden bg-white px-[64px] pb-[72px] pt-[56px]">
      {/* 머리: 매체명 + 분류 칩 / 위치 · 오른쪽 집행 기간 */}
      <div className="flex shrink-0 items-start justify-between gap-[40px]">
        <div className="flex min-w-0 flex-col gap-[14px]">
          <div className="flex min-w-0 items-center gap-[16px]">
            <span className="h-[36px] w-[6px] shrink-0 rounded-full bg-primary" />
            <p className="truncate text-[40px] font-bold leading-none tracking-[-1px] text-gray-900">
              {item.media_name ?? item.name ?? EMPTY}
            </p>
            <div className="flex shrink-0 items-center gap-[8px] pl-[4px]">
              {isMoving && <Chip accent>이동 매체</Chip>}
              {chips.map((chip) => (
                <Chip key={chip}>{chip}</Chip>
              ))}
            </div>
          </div>
          <p className="truncate pl-[22px] text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-gray-500">
            {location ?? "위치 정보 없음"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-[6px] pt-[2px]">
          <p className="text-[15px] font-medium leading-[1.4] text-gray-500">
            집행 기간
          </p>
          <p className="whitespace-nowrap text-[22px] font-semibold leading-[1.3] tracking-[-0.55px] text-gray-900 tabular-nums">
            {period}
          </p>
        </div>
      </div>

      <div className="mt-[32px] flex min-h-0 flex-1 gap-[24px]">
        {/* 왼쪽: 사진(정사각형에 가까운 칸) */}
        <div className="w-[860px] shrink-0 overflow-hidden rounded-[16px]">
          <MediaPhoto url={item.thumbnail_url} />
        </div>

        {/* 오른쪽: 설명·매체 정보 / 지도 + 금액 */}
        <div className="flex min-w-0 flex-1 flex-col gap-[24px]">
          {/* 매체 설명(배경·제목 없이, 자르지 않고 전부) + 매체 정보 사양표(2열) */}
          <div className="flex shrink-0 flex-col gap-[32px]">
            {/* 짧거나 없어도 3줄 높이(18px 기준)는 차지한다. 길면 표가 내려가고 아래 칸이 줄어든다. */}
            <p
              style={{ fontSize: descSize }}
              className="min-h-[86.4px] font-medium leading-[1.6] tracking-[-0.025em] text-gray-600 [word-break:keep-all]"
            >
              {item.description}
            </p>
            <div className="flex flex-col gap-[14px]">
              <CardTitle>매체 정보</CardTitle>
              <div className="grid grid-cols-2 gap-x-[40px]">
                {facts.map((fact) => (
                  <SpecRow key={fact.label} label={fact.label}>
                    {fact.value}
                  </SpecRow>
                ))}
              </div>
            </div>
          </div>
          {/* 남는 높이는 여백으로 두고, 모자라면 아래 칸이 380 → 260 까지 줄어든다. */}
          <div
            style={{ flexBasis: BOTTOM_MAX, minHeight: BOTTOM_MIN }}
            className="mt-auto flex shrink gap-[24px]"
          >
            <div className="min-w-0 flex-1 overflow-hidden rounded-[16px] bg-gray-50">
              {mapEnabled && hasCoords ? (
                <StaticKakaoMap
                  latitude={item.latitude as number}
                  longitude={item.longitude as number}
                  className="size-full"
                />
              ) : mapEnabled ? (
                <div className="flex size-full items-center justify-center text-[18px] font-medium text-gray-400">
                  {isMoving ? "이동 매체 · 고정 위치 없음" : "위치 정보 없음"}
                </div>
              ) : null}
            </div>
            <PriceCard item={item} />
          </div>
        </div>
      </div>
      <SlideWatermark />
    </div>
  );
}

export function MediaSlide({
  item,
  zoom,
  plans,
  selectedPlanNo,
  onPlanChange,
}: {
  item: ProposalItem;
  zoom: number;
  plans?: PlanOption[];
  selectedPlanNo?: number | null;
  onPlanChange?: (planNo: number) => void;
}) {
  return (
    <SlideScaler
      style={{ width: `${zoom}%` }}
      className="relative aspect-[1920/1080] shrink-0 rounded-[8px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <MediaTemplate
        item={item}
        plans={plans}
        selectedPlanNo={selectedPlanNo}
        onPlanChange={onPlanChange}
      />
    </SlideScaler>
  );
}

export function MediaThumb({
  item,
  mapEnabled = false,
}: {
  item: ProposalItem;
  mapEnabled?: boolean;
}) {
  return (
    <SlideScaler
      className="absolute inset-0"
      contentClassName="pointer-events-none"
    >
      <MediaTemplate item={item} mapEnabled={mapEnabled} />
    </SlideScaler>
  );
}
