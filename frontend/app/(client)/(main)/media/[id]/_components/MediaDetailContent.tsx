"use client";

import Image from "next/image";
import { type ReactNode, useState } from "react";

import { AddToProposalModal } from "@/components/common/AddToProposalModal";
import { AgeBarChart, type AgeRatio } from "@/components/common/AgeBarChart";
import { Button } from "@/components/common/buttons";
import { GenderDonut } from "@/components/common/GenderDonut";
import { DescriptionToggle } from "@/components/common/media-detail/DescriptionToggle";
import { FeaturesSection } from "@/components/common/media-detail/FeaturesSection";
import { MediaListSelect } from "@/components/common/media-detail/MediaListSelect";
import { PopulationSummaryBar } from "@/components/common/media-detail/PopulationSummaryBar";
import { SizeSection } from "@/components/common/media-detail/SizeSection";
import { FolderIcon } from "@/components/icons";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "맥스비전은 서울 지하철 1~4호선 주요 유동역사 24개소에 설치된 대형 디지털 광고 매체입니다. 역사 내 동선 중심부나 개찰구 주변, 환승 통로, 연결 계단 등 시야 확보가 우수한 위치에 설치되어 이용객의 이동 동선과 맞물린 자연스러운 노출이 가능합니다. 기존 사이니지보다 큰 사이즈의 디지털 스크린으로 구성되어 시각적 주목도가 높으며 일부 구간은 음성 송출이 가능해 브랜드 영상 콘텐츠 전달력이 우수합니다.";

type MediaListItem = { title: string; subtitle: string; planNo?: number };

const MEDIA_LIST_DEFAULT: MediaListItem[] = Array.from({ length: 6 }, () => ({
  title: "영상(20초) / 팬클럽 광고",
  subtitle: "1기 1면 / 20초 / 3일",
}));

const BADGE = {
  popular: { label: "인기", className: "bg-secondary text-primary" },
  new: { label: "신규", className: "bg-[#fff3d3] text-[#ff920a]" },
} as const;

const FEATURES: [string, string][] = [
  ["매체 카테고리", "지하철"],
  ["타입", "DOOH"],
  ["노출 종류", "실내"],
  ["판매 형태", "단품"],
  ["고정/이동", "고정"],
  ["상품 표시", "영상(20초)"],
  ["기기 수량", "1기 1면"],
  ["수동 송출 횟수", "120회"],
  ["계약 단위", "1달"],
  ["운영 시간", "매일 05:00 - 01:00"],
];

export type PopulationData = {
  monthlyFootTraffic: number;
  malePct: number;
  femalePct: number;
  ageRatios: AgeRatio[];
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-black">
      {children}
    </p>
  );
}

export function MediaDetailContent({
  name = "홍대입구역 아트 래핑",
  price = "최소집행금액 1,500만원 / 한달",
  badge = "new",
  description = DESCRIPTION,
  features = FEATURES,
  mediaList = MEDIA_LIST_DEFAULT,
  sizeText = "1920 * 1080 pixels",
  imageUrl,
  population = null,
  className,
  hidePopulation = false,
  mediaId,
}: {
  name?: string;
  price?: string;
  badge?: "popular" | "new" | null;
  description?: string;
  features?: [string, string][];
  mediaList?: MediaListItem[];
  sizeText?: string | null;
  imageUrl?: string | null;
  population?: PopulationData | null;
  className?: string;
  hidePopulation?: boolean;
  mediaId?: string;
} = {}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedList, setSelectedList] = useState(0);
  const [addOpen, setAddOpen] = useState(false);

  const showPopulation = !hidePopulation && !!population;
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
    <div
      className={cn(
        "flex flex-col items-center",
        className ?? "px-[100px] py-[80px]",
      )}
    >
      <div className="flex w-full max-w-[1016px] flex-col">
        <div className="relative h-[390px] w-full shrink-0 overflow-hidden rounded-[16px] bg-[#d9d9d9]">
          {imageUrl && (
            <Image
              src={mediaSrc(imageUrl)}
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 1016px"
              unoptimized={!isOptimizable(mediaSrc(imageUrl))}
              className="object-cover"
            />
          )}
        </div>

        <div className="flex flex-col gap-[36px] py-[36px]">
          <div className="flex flex-col gap-[36px]">
            <div className="flex items-start gap-[12px]">
              <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
                {badge && (
                  <span
                    className={cn(
                      "inline-flex w-fit items-center justify-center rounded-full px-[12px] py-[6px] text-base font-medium leading-[24px]",
                      BADGE[badge].className,
                    )}
                  >
                    {BADGE[badge].label}
                  </span>
                )}
                <div className="flex flex-col gap-[4px]">
                  <p className="text-[32px] font-bold leading-[40px] tracking-[-0.16px] text-black">
                    {name}
                  </p>
                  <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-grey-500">
                    {price}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="shrink-0"
                leftIcon={<FolderIcon />}
                disabled={!mediaId}
                onClick={() => setAddOpen(true)}
              >
                매체 담기
              </Button>
            </div>

            {showPopulation && population && (
              <PopulationSummaryBar
                monthlyTraffic={population.monthlyFootTraffic.toLocaleString()}
                mainAudience={[{ gender: primaryGender, age: primaryAge }]}
                size="lg"
              />
            )}
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>매체 설명</SectionTitle>
            <p
              className={cn(
                "whitespace-pre-wrap text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black",
                descExpanded ? "" : "line-clamp-3",
              )}
            >
              {description}
            </p>
            <DescriptionToggle
              expanded={descExpanded}
              onToggle={() => setDescExpanded((v) => !v)}
              size="lg"
            />
          </div>

          {mediaList.length > 0 && (
            <div className="flex flex-col gap-[24px]">
              <SectionTitle>매체 목록</SectionTitle>
              <MediaListSelect
                items={mediaList}
                value={selectedList}
                onChange={setSelectedList}
                size="lg"
                layout="grid"
              />
            </div>
          )}

          {sizeText && (
            <div className="flex flex-col gap-[24px]">
              <SectionTitle>규격</SectionTitle>
              <SizeSection sizeText={sizeText} size="lg" />
            </div>
          )}

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>특징</SectionTitle>
            <FeaturesSection features={features} size="lg" />
          </div>

          {showPopulation && population && (
            <div className="flex flex-col gap-[24px]">
              <SectionTitle>유동 인구 데이터</SectionTitle>
              <div className="flex items-stretch gap-[36px] rounded-[8px] border border-stroke p-[40px]">
                <div className="flex flex-1 flex-col gap-[16px]">
                  <p className="w-full text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-[#545454]">
                    성별 비율
                  </p>
                  <div className="flex flex-1 items-center justify-center">
                    <GenderDonut
                      male={population.malePct}
                      female={population.femalePct}
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-[16px]">
                  <p className="w-full text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-[#545454]">
                    연령대 비율
                  </p>
                  <div className="flex flex-1 items-center justify-center">
                    <AgeBarChart
                      data={population.ageRatios}
                      maxBarHeight={240}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {addOpen && mediaId && (
        <AddToProposalModal
          mediaId={mediaId}
          planNo={mediaList[selectedList]?.planNo}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}
