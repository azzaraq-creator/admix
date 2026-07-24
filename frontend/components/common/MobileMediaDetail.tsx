"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";

import { AgeBarChart, type AgeRatio } from "@/components/common/AgeBarChart";
import { GenderDonut } from "@/components/common/GenderDonut";
import { DescriptionToggle } from "@/components/common/media-detail/DescriptionToggle";
import { FeaturesSection } from "@/components/common/media-detail/FeaturesSection";
import { MediaListSelect } from "@/components/common/media-detail/MediaListSelect";
import { PopulationSummaryBar } from "@/components/common/media-detail/PopulationSummaryBar";
import { SizeSection } from "@/components/common/media-detail/SizeSection";
import { ChevronLeftIcon, FolderIcon } from "@/components/icons";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

export type MobilePopulation = {
  monthlyFootTraffic: number;
  malePct: number;
  femalePct: number;
  ageRatios: AgeRatio[];
};

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

export type MobileMediaListItem = { title: string; subtitle: string };

const DEFAULT_MEDIA_LIST: MobileMediaListItem[] = Array.from({ length: 3 }, () => ({
  title: "영상(20초) / 팬클럽 광고",
  subtitle: "1기 1면 / 20초 / 3일",
}));

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
  mediaList = DEFAULT_MEDIA_LIST,
  size = "3 * 1 meter",
  imageUrl,
  population = null,
  hidePopulation = false,
  hideMediaList = false,
  onBack,
  onAddProposal,
  className,
}: {
  name?: string;
  price?: string;
  badge?: "popular" | "new" | null;
  description?: string;
  features?: [string, string][];
  mediaList?: MobileMediaListItem[];
  size?: string | null;
  imageUrl?: string | null;
  population?: MobilePopulation | null;
  hidePopulation?: boolean;
  hideMediaList?: boolean;
  onBack?: () => void;
  onAddProposal?: () => void;
  className?: string;
}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedList, setSelectedList] = useState(0);
  const primaryGender = population
    ? population.malePct >= population.femalePct
      ? "남성"
      : "여성"
    : "";
  const primaryAge = population
    ? population.ageRatios.reduce((top, cur) =>
        cur.value > top.value ? cur : top,
      ).label
    : "";

  return (
    <div className={cn("flex w-full flex-col", className)}>
      <div className="relative h-[250px] w-full shrink-0 bg-[#d9d9d9]">
        {imageUrl && (
          <Image
            src={mediaSrc(imageUrl)}
            alt=""
            fill
            sizes="100vw"
            unoptimized={!isOptimizable(mediaSrc(imageUrl))}
            className="object-cover"
          />
        )}
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
                <p className="text-sm font-medium leading-[20px] text-grey-500">
                  {price}
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="매체 담기"
              onClick={onAddProposal}
              className="flex size-[40px] shrink-0 items-center justify-center rounded-[8px] bg-primary text-white"
            >
              <FolderIcon className="size-[24px]" />
            </button>
          </div>

          {!hidePopulation && population && (
            <PopulationSummaryBar
              monthlyTraffic={population.monthlyFootTraffic.toLocaleString()}
              mainAudience={[{ gender: primaryGender, age: primaryAge }]}
              size="sm"
            />
          )}
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
          <DescriptionToggle
            expanded={descExpanded}
            onToggle={() => setDescExpanded((v) => !v)}
            size="sm"
          />
        </div>

        {!hideMediaList && mediaList.length > 0 && (
          <div className="flex flex-col gap-[12px]">
            <SectionTitle>매체 목록</SectionTitle>
            <MediaListSelect
              items={mediaList}
              value={selectedList}
              onChange={setSelectedList}
              size="sm"
              layout="list"
            />
          </div>
        )}

        {size && (
          <div className="flex flex-col gap-[12px]">
            <SectionTitle>규격</SectionTitle>
            <SizeSection sizeText={size} size="sm" />
          </div>
        )}

        <div className="flex flex-col gap-[12px]">
          <SectionTitle>특징</SectionTitle>
          <FeaturesSection features={features} size="sm" />
        </div>

        {!hidePopulation && population && (
          <div className="flex flex-col gap-[16px]">
            <SectionTitle>유동 인구 데이터</SectionTitle>
            <div className="flex flex-col gap-[24px] rounded-[8px] border border-stroke p-[16px]">
              <div className="flex flex-col gap-[16px]">
                <p className="text-base font-semibold leading-[24px] text-[#545454]">
                  성별 비율
                </p>
                <div className="flex items-center justify-center">
                  <GenderDonut
                    male={population.malePct}
                    female={population.femalePct}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-[16px]">
                <p className="text-base font-semibold leading-[24px] text-[#545454]">
                  연령대 비율
                </p>
                <div className="flex items-center justify-center">
                  <AgeBarChart
                    data={population.ageRatios}
                    maxBarHeight={200}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
