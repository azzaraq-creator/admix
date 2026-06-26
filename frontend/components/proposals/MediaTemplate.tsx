"use client";

import { Fragment, type ReactNode } from "react";

import { StaticKakaoMap } from "@/components/common/StaticKakaoMap";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { PlanOption, ProposalItem } from "@/hooks/proposals";

import { SlideScaler } from "./SlideScaler";

const EMPTY = "-";

function formatNumber(value: number | null): string {
  if (value == null) return EMPTY;
  return value.toLocaleString("ko-KR");
}

function formatQuantity(device: number | null, surface: number | null): string {
  const d = device != null ? String(device) : EMPTY;
  const s = surface != null ? String(surface) : EMPTY;
  return `${d}기 ${s}면`;
}

function HeadCell({
  children,
  width,
  flex,
}: {
  children: ReactNode;
  width?: number;
  flex?: boolean;
}) {
  return (
    <div
      style={width ? { width } : undefined}
      className={`flex items-center justify-center px-[24px] py-[16px] ${flex ? "min-w-px flex-1" : "shrink-0"}`}
    >
      <p className="text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454]">
        {children}
      </p>
    </div>
  );
}

function TextCell({ children, width }: { children: ReactNode; width: number }) {
  return (
    <div
      style={{ width }}
      className="flex shrink-0 items-center justify-center px-[24px] py-[16px]"
    >
      <p className="text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454] [word-break:break-word]">
        {children}
      </p>
    </div>
  );
}

function BoxedCell({
  children,
  width,
  flex,
}: {
  children: ReactNode;
  width?: number;
  flex?: boolean;
}) {
  return (
    <div
      style={width ? { width } : undefined}
      className={`flex items-center justify-center px-[24px] py-[8px] ${flex ? "min-w-px flex-1" : "shrink-0"}`}
    >
      <div className="flex items-center justify-center rounded-[8px] border border-[#e4e5ee] px-[16px] py-[8px]">
        <p className="whitespace-nowrap text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454]">
          {children}
        </p>
      </div>
    </div>
  );
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
  const meta = [item.address, item.ooh_type, item.category].filter(
    (value): value is string => Boolean(value),
  );
  const hasCoords = item.latitude != null && item.longitude != null;

  const currentPlan =
    plans?.find((plan) => plan.plan_no === selectedPlanNo) ?? plans?.[0] ?? null;
  const operationTime =
    currentPlan?.operation_start_time && currentPlan?.operation_end_time
      ? `${currentPlan.operation_start_time}~${currentPlan.operation_end_time}`
      : EMPTY;

  return (
    <div className="flex h-[1080px] w-[1920px] flex-col gap-[24px] bg-white pl-[38px] pr-[40px] pt-[40px]">
      <div className="flex gap-[10px]">
        <div className="flex h-[500px] w-[500px] shrink-0 flex-col gap-[16px] bg-white p-[24px]">
          <div className="flex flex-col gap-[8px]">
            <p className="text-[32px] font-semibold leading-[1.4] tracking-[-0.8px] text-[#2f3442] [word-break:break-word]">
              {item.name ?? EMPTY}
            </p>
            {meta.length > 0 && (
              <div className="flex items-center gap-[10px]">
                {meta.map((value, index) => (
                  <Fragment key={`${value}-${index}`}>
                    {index > 0 && (
                      <div className="h-[16px] w-[2px] shrink-0 bg-[#e4e5ee]" />
                    )}
                    <p className="whitespace-nowrap text-[16px] font-normal leading-[1.4] tracking-[-0.4px] text-[#737586]">
                      {value}
                    </p>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
          {item.description && (
            <p className="text-[16px] font-medium leading-[1.4] tracking-[-0.4px] text-[#2f3442] [word-break:break-word]">
              {item.description}
            </p>
          )}
        </div>

        <div className="h-[500px] w-[822px] shrink-0 overflow-hidden rounded-[12px] bg-[#f6f6f6]">
          {item.thumbnail_url && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.thumbnail_url}
              alt=""
              className="size-full object-cover"
            />
          )}
        </div>

        <div className="h-[500px] w-[500px] shrink-0 overflow-hidden rounded-[12px] bg-[#f6f6f6]">
          {mapEnabled && hasCoords ? (
            <StaticKakaoMap
              latitude={item.latitude as number}
              longitude={item.longitude as number}
              className="size-full"
            />
          ) : mapEnabled ? (
            <div className="flex size-full items-center justify-center text-[18px] font-medium text-[#a0a0a0]">
              위치 정보 없음
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col">
        <div className="flex w-full items-center bg-[#f6f6f6]">
          <HeadCell flex>상품명</HeadCell>
          <HeadCell width={219}>노출회수</HeadCell>
          <HeadCell width={219}>판매수량</HeadCell>
          <HeadCell width={219}>규격</HeadCell>
          <HeadCell width={219}>운영시간</HeadCell>
          <HeadCell width={219}>기간</HeadCell>
          <HeadCell width={218}>광고비</HeadCell>
          <HeadCell width={218}>제작비용</HeadCell>
        </div>
        <div className="flex w-full items-center border-b border-[#e4e5ee] py-[16px]">
          {plans && plans.length > 1 && onPlanChange ? (
            <div className="flex min-w-px flex-1 items-center justify-center px-[24px] py-[8px]">
              <Select
                value={selectedPlanNo != null ? String(selectedPlanNo) : undefined}
                onValueChange={(value) => onPlanChange(Number(value))}
              >
                <SelectTrigger className="h-auto w-full gap-[8px] rounded-[8px] border-[#e4e5ee] px-[16px] py-[8px] text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454]">
                  <span className="flex-1 truncate text-center">
                    {currentPlan?.product_display_name ??
                      currentPlan?.product_name ??
                      `옵션 ${currentPlan?.plan_no ?? ""}`}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.plan_no} value={String(plan.plan_no)}>
                      {plan.product_display_name ??
                        plan.product_name ??
                        `옵션 ${plan.plan_no}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex min-w-px flex-1 items-center justify-center px-[24px] py-[8px]">
              <div className="flex w-full items-center justify-center rounded-[8px] border border-[#e4e5ee] px-[16px] py-[8px]">
                <p className="text-center text-[18px] font-medium leading-[1.4] tracking-[-0.45px] text-[#545454] [word-break:break-word]">
                  {item.product ?? EMPTY}
                </p>
              </div>
            </div>
          )}
          <TextCell width={219}>{EMPTY}</TextCell>
          <TextCell width={219}>
            {formatQuantity(item.device_quantity, item.surface_quantity)}
          </TextCell>
          <TextCell width={219}>{item.spec ?? EMPTY}</TextCell>
          <TextCell width={219}>{operationTime}</TextCell>
          <TextCell width={219}>{EMPTY}</TextCell>
          <BoxedCell width={218}>{formatNumber(item.price)}</BoxedCell>
          <BoxedCell width={218}>
            {formatNumber(currentPlan?.production_fee ?? null)}
          </BoxedCell>
        </div>
      </div>
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
    <SlideScaler className="absolute inset-0" contentClassName="pointer-events-none">
      <MediaTemplate item={item} mapEnabled={mapEnabled} />
    </SlideScaler>
  );
}
