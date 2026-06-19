"use client";

import { type ReactNode, useState } from "react";

import { AgeBarChart, type AgeRatio } from "@/components/common/AgeBarChart";
import { Button } from "@/components/common/buttons";
import { GenderDonut } from "@/components/common/GenderDonut";
import {
  ChevronDownIcon,
  FolderPlusIcon,
  MaximizeIcon,
  PlusIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

const DESCRIPTION =
  "맥스비전은 서울 지하철 1~4호선 주요 유동역사 24개소에 설치된 대형 디지털 광고 매체입니다. 역사 내 동선 중심부나 개찰구 주변, 환승 통로, 연결 계단 등 시야 확보가 우수한 위치에 설치되어 이용객의 이동 동선과 맞물린 자연스러운 노출이 가능합니다. 기존 사이니지보다 큰 사이즈의 디지털 스크린으로 구성되어 시각적 주목도가 높으며 일부 구간은 음성 송출이 가능해 브랜드 영상 콘텐츠 전달력이 우수합니다.";

const MEDIA_LIST = Array.from({ length: 6 }, (_, index) => ({
  key: `list-${index}`,
  title: "영상(20초) / 팬클럽 광고",
  subtitle: "1기 1면 / 20초 / 3일",
}));

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

const AGE_RATIO: AgeRatio[] = [
  { label: "10", value: 5.3, bound: "under" },
  { label: "20대", value: 24.9 },
  { label: "30대", value: 20.7 },
  { label: "40대", value: 15.9 },
  { label: "50대", value: 13.4 },
  { label: "60", value: 19.7, bound: "over" },
];

function MediaOption({
  title,
  subtitle,
  selected,
  onClick,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-[16px] rounded-[8px] p-[20px] text-left",
        selected ? "border-2 border-primary bg-secondary" : "border border-stroke",
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <p className="text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-black">
          {title}
        </p>
        <p className="text-base font-medium leading-[24px] text-[#757575]">
          {subtitle}
        </p>
      </div>
      <span
        className={cn(
          "flex size-[24px] shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-primary" : "border-[#d3d4d6]",
        )}
      >
        {selected && <span className="size-[12px] rounded-full bg-primary" />}
      </span>
    </button>
  );
}

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
  className,
}: {
  name?: string;
  price?: string;
  className?: string;
} = {}) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [selectedList, setSelectedList] = useState(0);

  return (
    <div className={cn("flex flex-col items-center", className ?? "px-[100px] py-[80px]")}>
      <div className="flex w-full max-w-[1016px] flex-col">
        <div className="flex h-[504px] w-full items-center gap-[8px] overflow-hidden rounded-[16px]">
          <div className="aspect-square h-full min-w-0 flex-1 bg-[#d9d9d9]" />
          <div className="flex h-full flex-col gap-[8px]">
            <div className="aspect-square min-h-0 flex-1 bg-[#d9d9d9]" />
            <button
              type="button"
              className="relative aspect-square min-h-0 flex-1 overflow-hidden bg-[#d9d9d9]"
            >
              <span className="absolute inset-0 bg-black/70" />
              <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-white">
                <PlusIcon className="size-[46px]" />
                <span className="text-[18px] font-medium tracking-[-0.45px]">
                  더보기
                </span>
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-[36px] py-[36px]">
          <div className="flex flex-col gap-[36px]">
            <div className="flex items-start gap-[12px]">
              <div className="flex min-w-0 flex-1 flex-col gap-[8px]">
                <span className="inline-flex w-fit items-center justify-center rounded-full bg-[#fff3d3] px-[12px] py-[6px] text-base font-medium leading-[24px] text-[#ff920a]">
                  신규
                </span>
                <div className="flex flex-col gap-[4px]">
                  <p className="text-[32px] font-bold leading-[40px] tracking-[-0.16px] text-black">
                    {name}
                  </p>
                  <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-[#757575]">
                    {price}
                  </p>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                className="shrink-0"
                leftIcon={<FolderPlusIcon />}
              >
                매체 담기
              </Button>
            </div>

            <div className="flex items-center justify-center gap-[20px] rounded-[12px] bg-[#f6f6f6] py-[24px]">
              <div className="flex flex-1 flex-col items-center gap-[8px] text-center">
                <p className="w-full text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-[#757575]">
                  월평균 유동인구 수
                </p>
                <p className="w-full text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-black">
                  313,643
                </p>
              </div>
              <div className="h-[52px] w-px self-stretch bg-stroke" />
              <div className="flex flex-1 flex-col items-center gap-[8px] text-center">
                <p className="w-full text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-[#757575]">
                  주요 인구층
                </p>
                <div className="flex w-full items-center justify-center gap-[12px] whitespace-nowrap text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-black">
                  <span className="flex items-center gap-[2px]">
                    <span>남성</span>
                    <span>20대</span>
                  </span>
                  <span className="flex items-center gap-[2px]">
                    <span>여성</span>
                    <span>30대</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>매체 설명</SectionTitle>
            <p
              className={cn(
                "whitespace-pre-wrap text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black",
                descExpanded ? "" : "line-clamp-3",
              )}
            >
              {DESCRIPTION}
            </p>
            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className="flex items-center justify-center gap-[8px]"
            >
              <span className="h-px flex-1 bg-[#f6f6f6]" />
              <span className="flex items-center gap-[4px] rounded-full bg-[#f6f6f6] px-[16px] py-[6px] text-[18px] leading-[28px] tracking-[-0.04px] text-black">
                매체 설명 {descExpanded ? "접기" : "더보기"}
                <ChevronDownIcon
                  className={cn("size-[20px] transition-transform", descExpanded && "rotate-180")}
                />
              </span>
              <span className="h-px flex-1 bg-[#f6f6f6]" />
            </button>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>매체 목록</SectionTitle>
            <div className="grid grid-cols-3 gap-[10px]">
              {MEDIA_LIST.map((item, index) => (
                <MediaOption
                  key={item.key}
                  title={item.title}
                  subtitle={item.subtitle}
                  selected={selectedList === index}
                  onClick={() => setSelectedList(index)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>규격</SectionTitle>
            <div className="flex items-center gap-[15px] rounded-[8px] border border-stroke p-[40px]">
              <MaximizeIcon className="size-[58px] shrink-0 text-black" />
              <div className="flex flex-col gap-[6px]">
                <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-[#757575]">
                  사이즈 및 규격
                </p>
                <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                  1920 * 1080 pixels
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>특징</SectionTitle>
            <div className="rounded-[8px] border border-stroke p-[40px]">
              <div className="flex flex-wrap gap-[24px]">
                {FEATURES.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex min-w-[296px] flex-1 flex-col gap-[6px] border-b border-stroke py-[6px] pr-[16px]"
                  >
                    <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-[#757575]">
                      {label}
                    </p>
                    <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[24px]">
            <SectionTitle>유동 인구 데이터</SectionTitle>
            <div className="flex items-start gap-[36px] rounded-[8px] border border-stroke p-[40px]">
              <div className="flex flex-1 flex-col items-center gap-[16px]">
                <p className="w-full text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-[#545454]">
                  성별 비율
                </p>
                <GenderDonut male={48} female={52} />
              </div>
              <div className="flex flex-1 flex-col gap-[16px]">
                <p className="w-full text-[20px] font-semibold leading-[28px] tracking-[-0.08px] text-[#545454]">
                  연령대 비율
                </p>
                <AgeBarChart data={AGE_RATIO} maxBarHeight={240} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
