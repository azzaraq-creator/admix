"use client";

import { Button } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import {
  KakaoMapRoadviewLink,
  RoadviewView,
} from "@/components/common/RoadviewView";
import { cn } from "@/lib/utils";

/**
 * 어드민 등급·추천 탭 — 매체 좌표의 카카오 로드뷰. 현장에 가지 않고 가시거리·가림·보는 방향·설치 높이·
 * 주변 다른 광고를 답하려고 띄운다. 가장 가까운 로드뷰 지점에서 매체 쪽을 바라보게 열고, 매체 자리에 핀을 꽂는다.
 * 로드뷰는 촬영 시점이 지금과 다를 수 있다. 접으면 로드뷰를 내리고(다시 펴면 새로 연다), 접힘 상태는 폼이 들고 있어
 * 다른 탭에 다녀와도 그대로다.
 */
export function RoadviewPanel({
  lat,
  lng,
  open,
  onToggle,
}: {
  lat: number;
  lng: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex flex-col gap-[8px] rounded-[12px] border border-stroke p-[16px]">
      <div className="flex flex-wrap items-center justify-between gap-[8px]">
        {/* 접기·펴기 머리 — 설명이 길어 줄바꿈되도록 HeroUI 버튼의 높이·한 줄 고정을 푼다. */}
        <Button
          variant="ghost"
          onPress={onToggle}
          aria-expanded={open}
          className="h-auto items-start justify-start gap-[6px] whitespace-normal rounded-none p-0 text-left data-[hovered=true]:bg-transparent data-[pressed=true]:bg-transparent"
        >
          <ChevronDown
            className={cn(
              "mt-[3px] size-[16px] shrink-0 text-gray-600 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="flex flex-col gap-[2px]">
            <span className="text-[15px] font-bold text-black">로드뷰</span>
            {open && (
              <span className="text-[12px] text-gray-400">
                화면을 끌어 둘러보며 가시거리·가림·보는 방향·설치 높이·주변 다른
                광고를 답해 주세요. 촬영 시점이 지금과 다를 수 있어요.
              </span>
            )}
          </span>
        </Button>
        <KakaoMapRoadviewLink lat={lat} lng={lng} />
      </div>
      {open && (
        <RoadviewView
          lat={lat}
          lng={lng}
          className="h-[360px] max-sm:h-[240px]"
        />
      )}
    </div>
  );
}
