"use client";

import { useState } from "react";

import { ChevronDownIcon, MapPinIcon, XIcon } from "@/components/icons";

import type { MediaItemData } from "./MediaItem";

export type MediaDetail = {
  subName?: string;
  monthlyTraffic?: string;
  mainAudience?: { gender: string; age: string }[];
  address?: string;
  description?: string;
  genderRatio?: { male: number; female: number };
  ageRatio?: { label: string; value: number; bound?: "under" | "over" }[];
};

const SAMPLE_DETAIL: Required<MediaDetail> = {
  subName: "",
  monthlyTraffic: "313,643",
  mainAudience: [
    { gender: "남성", age: "20대" },
    { gender: "여성", age: "30대" },
  ],
  address: "서울 마포구 양화로 지하 160",
  description:
    "맥스비전은 서울 지하철 1~4호선 주요 유동역사 24개소에 설치된 대형 디지털 광고 매체입니다. 역사 내 동선 중심부나 개찰구 주변, 환승 통로, 연결 계단 등 시야 확보가 우수한 위치에 설치되어 이용객의 이동 동선과 맞물린 자연스러운 노출이 가능합니다. 기존 사이니지보다 큰 사이즈의 디지털 스크린으로 구성되어 시각적 주목도가 높으며 일부 구간은 음성 송출이 가능해 브랜드 영상 콘텐츠 전달력이 우수합니다.",
  genderRatio: { male: 48, female: 52 },
  ageRatio: [
    { label: "10", value: 5.3, bound: "under" },
    { label: "20대", value: 24.9 },
    { label: "30대", value: 20.7 },
    { label: "40대", value: 15.9 },
    { label: "50대", value: 13.4 },
    { label: "60", value: 19.7, bound: "over" },
  ],
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
  const data = { ...SAMPLE_DETAIL, ...detail };
  const images = media.images?.length ? media.images : [null, null];
  const hasPopulation = Boolean(data.genderRatio || data.ageRatio.length);
  const maxAge = Math.max(...data.ageRatio.map((a) => a.value));

  return (
    <div className="relative flex h-screen w-[385px] shrink-0 flex-col overflow-y-auto bg-[#eee]">
      <div className="relative shrink-0">
        <div className="flex h-[200px] w-full items-center justify-center gap-[2px] overflow-hidden bg-white">
          {images.map((src, index) => (
            <div
              key={index}
              className="relative aspect-square min-w-0 flex-1 self-stretch bg-[#d9d9d9]"
            >
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="size-full object-cover" />
              )}
            </div>
          ))}
        </div>
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
                <span className="ml-[6px] text-[14px] font-medium text-[#757575]">
                  {data.subName}
                </span>
              )}
            </p>
            <p className="text-sm font-medium leading-[20px] text-[#757575]">
              {media.price}
            </p>
          </div>

          <div className="flex items-center justify-center gap-[20px] rounded-[12px] bg-[#f6f6f6] p-[12px]">
            <div className="flex flex-1 flex-col items-center">
              <p className="w-full text-center text-sm font-medium leading-[20px] text-[#757575]">
                월평균 유동인구수
              </p>
              <p className="w-full text-center text-base font-bold leading-[24px] text-black">
                {data.monthlyTraffic}
              </p>
            </div>
            <div className="h-[40px] w-px self-stretch bg-stroke" />
            <div className="flex flex-1 flex-col items-center">
              <p className="w-full text-center text-sm font-medium leading-[20px] text-[#757575]">
                주요 인구층
              </p>
              <div className="flex w-full items-center justify-center gap-[6px] whitespace-nowrap text-base font-bold leading-[24px] text-black">
                {data.mainAudience.map((a, index) => (
                  <span key={index} className="flex items-center gap-[2px]">
                    <span>{a.gender}</span>
                    <span>{a.age}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-[8px]">
            <button
              type="button"
              onClick={onAddProposal}
              className="flex flex-1 items-center justify-center rounded-[8px] bg-[#f1f5f9] px-[16px] py-[12px] text-base font-medium text-black"
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

        <section className="flex items-center gap-[14px] bg-white p-[24px]">
          <MapPinIcon className="size-[20px] shrink-0 text-black" />
          <p className="text-base font-medium leading-[24px] text-black">
            {data.address}
          </p>
        </section>

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
          <button
            type="button"
            onClick={() => setDescExpanded((v) => !v)}
            className="flex items-center justify-center gap-[8px]"
          >
            <span className="h-px flex-1 bg-[#f6f6f6]" />
            <span className="flex items-center gap-[2px] rounded-full bg-[#f6f6f6] px-[16px] py-[6px] text-sm leading-[20px] text-black">
              매체 설명 {descExpanded ? "접기" : "더보기"}
              <ChevronDownIcon
                className={`size-[18px] transition-transform ${descExpanded ? "rotate-180" : ""}`}
              />
            </span>
            <span className="h-px flex-1 bg-[#f6f6f6]" />
          </button>
        </section>

        {hasPopulation && (
          <section className="flex flex-col gap-[30px] bg-white p-[24px]">
            <p className="text-base font-semibold leading-[24px] text-black">
              유동 인구 데이터
            </p>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-medium leading-[20px] text-[#545454]">
                성별 비율
              </p>
              <div className="flex justify-center py-[6px]">
                <div
                  className="relative flex size-[220px] items-center justify-center rounded-full"
                  style={{
                    background: `conic-gradient(#ff7a00 0% ${data.genderRatio.female}%, #16c60c ${data.genderRatio.female}% 100%)`,
                  }}
                >
                  <div className="absolute inset-[30px] flex items-center justify-center gap-[20px] rounded-full bg-white">
                    <div className="flex flex-col items-center gap-[8px]">
                      <span className="text-base font-semibold text-black">
                        남성
                      </span>
                      <span className="flex items-end text-[#16c60c]">
                        <span className="text-[28px] font-semibold leading-[32px]">
                          {data.genderRatio.male}
                        </span>
                        <span className="text-[20px] leading-[28px]">%</span>
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-[8px]">
                      <span className="text-base font-semibold text-black">
                        여성
                      </span>
                      <span className="flex items-end text-[#ff7a00]">
                        <span className="text-[28px] font-semibold leading-[32px]">
                          {data.genderRatio.female}
                        </span>
                        <span className="text-[20px] leading-[28px]">%</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-[16px]">
              <p className="text-sm font-medium leading-[20px] text-[#545454]">
                연령대 비율
              </p>
              <div className="flex h-[260px] items-end justify-between gap-[6px]">
                {data.ageRatio.map((age) => {
                  const primary = age.value === maxAge;
                  return (
                    <div
                      key={age.label}
                      className="flex h-full flex-1 flex-col items-center justify-end gap-[8px]"
                    >
                      <div className="flex items-center">
                        <span
                          className={`text-sm font-semibold leading-[20px] ${primary ? "text-primary" : "text-black"}`}
                        >
                          {age.value}
                        </span>
                        <span
                          className={`text-xs font-medium leading-[16px] ${primary ? "text-primary" : "text-black"}`}
                        >
                          %
                        </span>
                      </div>
                      <div
                        className={`w-[22px] rounded-t-full ${primary ? "bg-primary" : "bg-secondary"}`}
                        style={{ height: `${Math.round((age.value / maxAge) * 200)}px` }}
                      />
                      <span className="text-sm font-semibold leading-[20px] text-[#757575]">
                        {age.bound === "under"
                          ? `~${age.label}`
                          : age.bound === "over"
                            ? `${age.label}~`
                            : age.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
