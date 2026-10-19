"use client";

import { useState } from "react";

import { ArrowUpIcon, ChevronLeftIcon, MixieIcon } from "@/components/icons";
import type { V2Message } from "@/hooks/adRecommendReact";
import { cn } from "@/lib/utils";

import { AssistantBubble } from "../fixed/_components/chat/AssistantBubble";
import { useLnbCollapsed } from "./useLnb";

const DEMO_IMAGE = "/guide/demo-billboard.svg";

/** 가이드용 예시 대화 — 실제 믹시 답변이 아니다(보여 주기만). */
const DEMO_MESSAGES: V2Message[] = [
  {
    id: "demo-user-1",
    type: "user",
    content: "강남역 근처 20대 여성 타겟, 월 2,000만원 이하 매체 추천해 줘",
  },
  {
    id: "demo-mixie-1",
    type: "assistant",
    response_type: "list",
    message:
      "강남역 주변에서 **20대 여성 유동인구가 많은** 매체 2개를 골랐어요. 마음에 드는 매체는 기획안에 바로 담아 드릴게요.",
    items: [
      {
        id: "guide-demo-1",
        media_id: "guide-demo-1",
        name: "[예시] 강남역 사거리 옥상 빌보드",
        media_source: "FIXED",
        thumbnail_url: DEMO_IMAGE,
        detail_images: [],
        category_large: "전광판/빌보드",
        category_small: "빌보드",
        address: "서울 강남구 강남대로 396 (역삼동)",
        min_advertisement_fee_krw: 15_000_000,
        min_production_fee_krw: 1_200_000,
      },
      {
        id: "guide-demo-2",
        media_id: "guide-demo-2",
        name: "[예시] 신논현역 대합실 와이드 DID",
        media_source: "FIXED",
        thumbnail_url: DEMO_IMAGE,
        detail_images: [],
        category_large: "지하철",
        category_small: "지하철역",
        address: "서울 강남구 강남대로 지하 470 (논현동)",
        min_advertisement_fee_krw: 8_000_000,
        min_production_fee_krw: null,
      },
    ],
  },
  {
    id: "demo-user-2",
    type: "user",
    content: "첫 번째 매체 기획안에 담아 줘",
  },
  {
    id: "demo-mixie-2",
    type: "assistant",
    response_type: "chat",
    message:
      "**강남 브랜딩 캠페인** 기획안에 담았어요 ✓\n다른 화면을 보면서도 여기서 계속 물어보세요.",
  },
];

/** 실제 패널과 같은 사용자 말풍선(HomeChat UserBubble). */
function DemoUserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-[85%] rounded-[19px] rounded-br-[4px] border border-gray-200 bg-white px-[16px] py-[8px] text-[14px] leading-[24px] text-gray-900">
      {content}
    </div>
  );
}

/**
 * 대시보드 가이드의 "AI 믹시 패널" 단계 — 패널이 열린 것처럼 예시 대화를 띄운다.
 * 실제 패널(MixieChatPanel)과 같은 자리·층·머리말·말풍선이지만, 대화를 불러오거나 보내지 않는다.
 * PC는 실제 패널처럼 LNB(z-40) 아래(z-35)라 LNB 접기 버튼이 패널 위로 올라온다.
 * 모바일은 실제로는 화면 전체를 덮지만, 설명 카드가 아래에 들어가도록 위쪽만 차지한다.
 */
export function MixiePanelPreview({ visible }: { visible: boolean }) {
  const lnbCollapsed = useLnbCollapsed();
  const [showPhotos, setShowPhotos] = useState(false);

  return (
    <aside
      aria-hidden
      data-tour="mixie-panel-demo"
      className={cn(
        "fixed inset-x-0 top-0 z-50 flex transition-opacity duration-300 ease-out motion-reduce:transition-none h-[62dvh] flex-col overflow-hidden rounded-b-[20px] bg-white sm:inset-y-0 sm:right-auto sm:z-[35] sm:h-auto sm:w-[400px] sm:rounded-none sm:border-r sm:border-gray-200 sm:shadow-[4px_0_16px_0_rgba(0,0,0,0.08)]",
        lnbCollapsed ? "sm:left-[78px]" : "sm:left-[180px]",
        !visible && "opacity-0",
      )}
    >
      <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-[16px]">
        <div className="flex items-center gap-[8px]">
          <MixieIcon className="size-[18px] shrink-0" />
          <span className="text-[15px] font-semibold text-gray-900">
            AI 믹시
          </span>
        </div>
        <span className="flex size-[28px] items-center justify-center text-gray-500">
          <ChevronLeftIcon className="size-[16px]" />
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col bg-gray-50 px-[16px] pt-[16px]">
        {/* 모바일은 높이가 낮아, 실제 대화처럼 최근 대화(아래)부터 보이게 한다. */}
        <div className="flex min-h-0 flex-1 flex-col items-end gap-[14px] overflow-hidden max-sm:justify-end">
          {DEMO_MESSAGES.map((message) =>
            message.type === "user" ? (
              <DemoUserBubble
                key={message.id}
                content={message.content ?? ""}
              />
            ) : (
              <div key={message.id} className="w-full">
                <AssistantBubble
                  message={message}
                  showPhotos={showPhotos}
                  onTogglePhotos={setShowPhotos}
                  showAvatar={false}
                />
              </div>
            ),
          )}
        </div>
        <div className="relative -mx-[16px] shrink-0 border-t border-gray-200 bg-white px-[16px] pt-[12px] pb-[12px]">
          <div className="flex h-[44px] items-center rounded-[19px] border border-gray-200 bg-gray-100 pr-[48px] pl-[16px] text-[14px] text-[#a1a1aa]">
            믹시에게 이어서 물어보세요
          </div>
          <span className="absolute top-[16px] right-[20px] flex size-[36px] items-center justify-center rounded-[15px] bg-primary-300 text-white">
            <ArrowUpIcon className="size-[18px]" />
          </span>
        </div>
      </div>
    </aside>
  );
}
