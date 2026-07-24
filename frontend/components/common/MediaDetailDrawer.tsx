"use client";

import { useState } from "react";

import { MapPinIcon, XIcon } from "@/components/icons";

import { AgeBarChart } from "./AgeBarChart";
import { GenderDonut } from "./GenderDonut";
import { ImageLightbox } from "./ImageLightbox";
import { DescriptionToggle } from "./media-detail/DescriptionToggle";
import { PopulationSummaryBar } from "./media-detail/PopulationSummaryBar";
import { MediaDetailImages } from "./MediaDetailImages";
import type { MediaItemData } from "./MediaItem";

export type MediaDetail = {
  subName?: string;
  images?: string[];
  monthlyTraffic?: string;
  mainAudience?: { gender: string; age: string }[];
  address?: string;
  description?: string;
  genderRatio?: { male: number; female: number };
  ageRatio?: { label: string; value: number; bound?: "under" | "over" }[];
};

type MediaDetailDrawerProps = {
  media: MediaItemData;
  detail?: MediaDetail;
  onClose: () => void;
  onAddProposal?: () => void;
  onViewDetail?: () => void;
};

export function MediaDetailDrawer({
  media,
  detail,
  onClose,
  onAddProposal,
  onViewDetail,
}: MediaDetailDrawerProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const data = detail ?? {};
  // 상세 API의 전체 이미지 우선(개수 기반 배치·더보기용), 없으면 목록 카드 이미지로 폴백.
  const images =
    data.images?.length
      ? data.images
      : (media.images?.filter((src): src is string => Boolean(src)) ?? []);
  const mainAudience = data.mainAudience ?? [];
  const ageRatio = data.ageRatio ?? [];
  const genderRatio = data.genderRatio;
  const hasPopulation = Boolean(genderRatio && ageRatio.length);

  return (
    <div className="relative flex h-screen w-[385px] shrink-0 flex-col overflow-y-auto bg-[#eee]">
      <div className="relative shrink-0">
        <MediaDetailImages images={images} onOpen={setLightboxIndex} />
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-[16px] top-[16px] flex items-center justify-center rounded-full bg-white p-[6px] text-black drop-shadow-[0px_0px_2px_rgba(0,0,0,0.25)]"
        >
          <XIcon className="size-[16px]" />
        </button>
      </div>

      <div className="flex flex-col gap-[12px]">
        <section className="flex flex-col gap-[18px] bg-white p-[24px]">
          <div className="flex flex-col">
            <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
              {media.name}
              {data.subName && (
                <span className="ml-[6px] text-[14px] font-medium text-grey-500">
                  {data.subName}
                </span>
              )}
            </p>
            <p className="text-sm font-medium leading-[20px] text-grey-500">
              {media.price}
            </p>
          </div>

          {hasPopulation && (
            <PopulationSummaryBar
              monthlyTraffic={data.monthlyTraffic ?? ""}
              mainAudience={mainAudience}
              size="sm"
            />
          )}

          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={onAddProposal}
              className="flex flex-1 items-center justify-center rounded-[8px] bg-platinum-100 px-[16px] py-[12px] text-base font-medium text-black"
            >
              매체 담기
            </button>
            <button
              type="button"
              onClick={onViewDetail}
              className="flex flex-1 items-center justify-center rounded-[8px] bg-primary px-[16px] py-[12px] text-base font-medium text-white"
            >
              자세히
            </button>
          </div>
        </section>

        {data.address && (
        <section className="flex items-center gap-[14px] bg-white p-[24px]">
          <MapPinIcon className="size-[20px] shrink-0 text-black" />
          <p className="text-base font-medium leading-[24px] text-black">
            {data.address}
          </p>
        </section>
        )}

        {data.description && (
        <section className="flex flex-col gap-[18px] bg-white p-[24px]">
          <div className="flex flex-col gap-[24px]">
            <p className="text-base font-semibold leading-[24px] text-black">
              매체 설명
            </p>
            <p
              className={`whitespace-pre-wrap text-sm font-medium leading-[24px] text-black ${
                descExpanded ? "" : "line-clamp-3"
              }`}
            >
              {data.description}
            </p>
          </div>
          <DescriptionToggle
            expanded={descExpanded}
            onToggle={() => setDescExpanded((v) => !v)}
            size="sm"
          />
        </section>
        )}

        {hasPopulation && genderRatio && (
          <section className="flex flex-col gap-[30px] bg-white p-[24px]">
            <p className="text-base font-semibold leading-[24px] text-black">
              유동 인구 데이터
            </p>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-medium leading-[20px] text-[#545454]">
                성별 비율
              </p>
              <GenderDonut
                male={genderRatio.male}
                female={genderRatio.female}
                className="py-[6px]"
              />
            </div>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-medium leading-[20px] text-[#545454]">
                연령대 비율
              </p>
              <AgeBarChart data={ageRatio} maxBarHeight={200} />
            </div>
          </section>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
