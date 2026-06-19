"use client";

import { type ReactNode, useState } from "react";

import { AgeBarChart, type AgeRatio } from "@/components/common/AgeBarChart";
import { GenderDonut } from "@/components/common/GenderDonut";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  FolderPlusIcon,
  MaximizeIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

export type MobileMediaStat = { label: string; value: ReactNode };

const DEFAULT_DESCRIPTION =
  "서울 전역의 주요 간선도로를 따라 운행하는 시내버스 외부광고 매체로 도심 업무지와 상업시설을 중심으로 생활권 전반을 폭넓게 커버하며 이동 동선 내에서 반복적인 노출을 통해 높은 주목도를 확보할 수 있습니다. 일상 속 자연스러운 이동 환경 속에서 브랜드 인지도를 확산시키기에 적합한 매체입니다.";

const DEFAULT_FEATURES: [string, string][] = [
  ["매체 카테고리", "버스"],
  ["타입", "OOH"],
  ["노출 종류", "실외"],
  ["판매 형태", "단품"],
  ["고정/이동", "이동"],
  ["송출 시간", "-"],
  ["수동 송출 횟수", "-"],
  ["계약 단위", "1달"],
  ["운영 시간", "매일 00:00 - 24:00"],
];

const DEFAULT_STATS: MobileMediaStat[] = [
  { label: "최소집행금액", value: "16만원" },
  { label: "최소계약기간", value: "1달" },
];

const AGE_RATIO: AgeRatio[] = [
  { label: "10", value: 5.3, bound: "under" },
  { label: "20대", value: 24.9 },
  { label: "30대", value: 20.7 },
  { label: "40대", value: 15.9 },
  { label: "50대", value: 13.4 },
  { label: "60", value: 19.7, bound: "over" },
];

const BADGE = {
  popular: { label: "인기", className: "bg-secondary text-primary" },
  new: { label: "신규", className: "bg-[#fff3d3] text-[#ff920a]" },
} as const;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[18px] font-bold leading-[28px] tracking-[-0.04px] text-black">
      {children}
    </p>
  );
}

export function MobileMediaDetail({
  name = "서울 버스 TV",
  price = "최소집행금액 16만원 / 한달",
  badge,
  description = DEFAULT_DESCRIPTION,
  features = DEFAULT_FEATURES,
  size = "3 * 1 meter",
  stats = DEFAULT_STATS,
  hidePopulation = false,
  hideMediaList = false,
  onBack,
  className,
}: {
  name?: string;
  price?: string;
  badge?: "popular" | "new";
  description?: string;
  features?: [string, string][];
  size?: string;
  stats?: MobileMediaStat[];
  hidePopulation?: boolean;
  hideMediaList?: boolean;
  onBack?: () => void;
  className?: string;
}) {
  const [descExpanded, setDescExpanded] = useState(false);

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="relative h-[250px] w-full shrink-0 bg-[#d9d9d9]">
        {onBack && (
          <button
            type="button"
            aria-label="목록으로"
            onClick={onBack}
            className="absolute left-[16px] top-[16px] flex size-[36px] items-center justify-center rounded-full bg-white/90 text-black drop-shadow-[0px_0px_4px_rgba(0,0,0,0.2)]"
          >
            <ChevronLeftIcon className="size-[20px]" />
          </button>
        )}
      </div>

      <div className="flex flex-col gap-[24px] px-[16px] py-[16px]">
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
              {badge && (
                <span
                  className={cn(
                    "inline-flex w-fit items-center justify-center rounded-full px-[10px] py-[4px] text-xs font-medium leading-[16px]",
                    BADGE[badge].className,
                  )}
                >
                  {BADGE[badge].label}
                </span>
              )}
              <div className="flex flex-col gap-[4px]">
                <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                  {name}
                </p>
                <p className="text-sm font-medium leading-[20px] text-[#757575]">
                  {price}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="매체 담기"
              className="flex size-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary text-white"
            >
              <FolderPlusIcon className="size-[24px]" />
            </button>
          </div>

          <div className="flex items-center rounded-[12px] bg-[#f6f6f6] py-[12px]">
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex flex-1 items-center">
                {index > 0 && <div className="h-[44px] w-px bg-stroke" />}
                <div className="flex flex-1 flex-col items-center gap-[2px] px-[12px] text-center">
                  <p className="text-sm font-medium leading-[20px] text-[#757575]">
                    {stat.label}
                  </p>
                  <p className="text-base font-bold leading-[24px] text-black">
                    {stat.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <SectionTitle>매체 설명</SectionTitle>
          <p
            className={cn(
              "whitespace-pre-wrap text-sm font-medium leading-[20px] text-black",
              descExpanded ? "" : "line-clamp-3",
            )}
          >
            {description}
          </p>
          <button
            type="button"
            onClick={() => setDescExpanded((v) => !v)}
            className="flex items-center justify-center gap-[8px]"
          >
            <span className="h-px flex-1 bg-[#f6f6f6]" />
            <span className="flex items-center gap-[4px] text-sm leading-[20px] text-black">
              매체 설명 {descExpanded ? "접기" : "더보기"}
              <ChevronDownIcon
                className={cn(
                  "size-[18px] transition-transform",
                  descExpanded && "rotate-180",
                )}
              />
            </span>
            <span className="h-px flex-1 bg-[#f6f6f6]" />
          </button>
        </div>

        <div className="flex flex-col gap-[12px]">
          <SectionTitle>규격</SectionTitle>
          <div className="flex items-center gap-[16px] rounded-[8px] border border-stroke px-[16px] py-[12px]">
            <MaximizeIcon className="size-[24px] shrink-0 text-black" />
            <div className="flex flex-col gap-[2px]">
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                사이즈 및 규격
              </p>
              <p className="text-base font-medium leading-[20px] text-black">
                {size}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <SectionTitle>특징</SectionTitle>
          <div className="rounded-[8px] border border-stroke px-[16px] py-[12px]">
            {features.map(([label, value]) => (
              <div
                key={label}
                className="flex flex-col gap-[2px] border-b border-stroke py-[12px] last:border-b-0"
              >
                <p className="text-sm font-medium leading-[20px] text-[#757575]">
                  {label}
                </p>
                <p className="text-base font-medium leading-[20px] text-black">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {!hideMediaList && (
          <div className="flex flex-col gap-[12px]">
            <SectionTitle>매체 목록</SectionTitle>
            <div className="flex flex-col gap-[8px]">
              {[0, 1, 2].map((index) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "flex items-center gap-[12px] rounded-[8px] p-[16px] text-left",
                    index === 0
                      ? "border-2 border-primary bg-secondary"
                      : "border border-stroke",
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <p className="text-base font-semibold leading-[24px] text-black">
                      영상(20초) / 팬클럽 광고
                    </p>
                    <p className="text-sm font-medium leading-[20px] text-[#757575]">
                      1기 1면 / 20초 / 3일
                    </p>
                  </div>
                  <span
                    className={cn(
                      "flex size-[24px] shrink-0 items-center justify-center rounded-full border-2",
                      index === 0 ? "border-primary" : "border-[#d3d4d6]",
                    )}
                  >
                    {index === 0 && (
                      <span className="size-[12px] rounded-full bg-primary" />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!hidePopulation && (
          <div className="flex flex-col gap-[16px]">
            <SectionTitle>유동 인구 데이터</SectionTitle>
            <div className="flex flex-col gap-[24px] rounded-[8px] border border-stroke p-[16px]">
              <div className="flex flex-col gap-[16px]">
                <p className="text-base font-semibold leading-[24px] text-[#545454]">
                  성별 비율
                </p>
                <div className="flex items-center justify-center">
                  <GenderDonut male={48} female={52} />
                </div>
              </div>
              <div className="flex flex-col gap-[16px]">
                <p className="text-base font-semibold leading-[24px] text-[#545454]">
                  연령대 비율
                </p>
                <div className="flex items-center justify-center">
                  <AgeBarChart data={AGE_RATIO} maxBarHeight={200} className="w-full" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
