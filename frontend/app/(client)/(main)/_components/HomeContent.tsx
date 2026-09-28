"use client";

import { Breadcrumbs, Button } from "@heroui/react";
import { useState } from "react";

import {
  ChevronDownIcon,
  MixieIcon,
  ScrollMouseIcon,
  SearchDuotoneIcon,
} from "@/components/icons";

import { AiSearchBox } from "./AiSearchBox";
import { HomeChat } from "./HomeChat";
import { ModeToggle, type Mode } from "./ModeToggle";
import { useMixieChat } from "./useMixieChat";

const SUGGESTIONS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
  "500만원 이하 매체를 찾아주세요",
];

// 검색 모드는 자연어 질문 대신, 검색어로 그대로 넣을 수 있는 지역·매체명을 권한다.
const SEARCH_SUGGESTIONS: { title: string; items: string[] }[] = [
  {
    title: "추천 지역",
    items: ["강남", "홍대입구", "성수", "명동", "광화문"],
  },
  {
    title: "추천 매체",
    items: [
      "H-LIVE 현대백화점 무역센터점 전광판",
      "명동 K파이낸스빌딩",
      "서울역 부양빌딩",
      "이태원 스크린LED 전광판",
    ],
  },
];

// 추천 칩. HeroUI sm 버튼은 높이 32px이고, 이 프로젝트의 곡률 규칙이
// "높이/2 - 3px"(전송 버튼 40px→17px, 모드 탭 32px→13px)이라 13px이 된다.
const SUGGESTION_CHIP_CLASS =
  "rounded-[13px] border-[#ececef] bg-white text-[#71717a] transition-colors hover:text-black";

const MODE_LABEL: Record<Mode, string> = {
  ai: "AI 믹시",
  search: "검색",
};

const TITLE: Record<Mode, string> = {
  ai: "무엇을 도와드릴까요?",
  search: "어디에 광고하고 싶으세요?",
};

const SUBTITLE: Record<Mode, string> = {
  ai: "옥외광고, AI 믹시에게 물어보세요",
  search: "원하는 옥외광고 매체를 검색해 보세요",
};

export function HomeContent() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("ai");
  // 대화는 이 화면에서 이어진다(시안 "01-1. 믹시 대화"). 대화 상태는 레이아웃에
  // 한 벌만 있어(useMixieChat) 다른 메뉴에 다녀와도, LNB 패널에서 이어 말해도 그대로다.
  const { chat } = useMixieChat();
  // 대화 중에도 우측 상단 탭으로 검색 화면에 갈 수 있고, AI로 돌아오면 대화가 다시 보인다.
  const hasConversation = mode === "ai" && chat.messages.length > 0;

  return (
    // 첫 화면은 화면 높이를 꽉 채우고, 그 아래로 대시보드 콘텐츠가 이어진다(스크롤해서 본다).
    // 대화 중엔 높이를 화면에 고정해 대화 목록이 안에서 스크롤되고, 목록 끝에서 더 내리면
    // 바깥(홈 화면)이 이어서 스크롤돼 아래 콘텐츠가 보인다.
    <div
      className={`flex shrink-0 flex-col px-[20px] pb-[24px] sm:px-[50px] ${
        hasConversation ? "h-full" : "min-h-full"
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-[12px] pt-[30px] sm:pt-[52px]">
        <Breadcrumbs
          aria-label="현재 위치"
          separator="/"
          className="admix-breadcrumbs text-[13px] text-[#64748b]"
        >
          {/* 아직 이동할 대시보드 페이지가 없어 두 항목 모두 표시 전용이다. */}
          <Breadcrumbs.Item isDisabled>대시보드</Breadcrumbs.Item>
          <Breadcrumbs.Item isDisabled>{MODE_LABEL[mode]}</Breadcrumbs.Item>
        </Breadcrumbs>
        <ModeToggle value={mode} onChange={setMode} />
      </div>

      {hasConversation ? (
        <div className="flex min-h-0 w-full flex-1 flex-col py-[24px]">
          <HomeChat />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col items-center justify-center py-[40px]">
          {mode === "search" ? (
            <SearchDuotoneIcon className="size-[70px] shrink-0" />
          ) : (
            <MixieIcon className="size-[70px] shrink-0 drop-shadow-[0_4px_12px_rgba(163,59,209,0.2)]" />
          )}

          <h1 className="mt-[16px] text-center text-[28px] font-bold text-black sm:text-[36px]">
            {TITLE[mode]}
          </h1>
          <p className="mt-[12px] text-center text-base text-[#888]">
            {SUBTITLE[mode]}
          </p>

          <div className="mt-[20px] flex w-full justify-center">
            <AiSearchBox
              value={query}
              onValueChange={setQuery}
              mode={mode}
              onAiSubmit={(text) => chat.submit(text, { allowShort: true })}
            />
          </div>

          {mode === "ai" && (
            <p className="mt-[20px] max-w-[860px] text-center text-xs text-[#64748b]">
              AI 믹시 채팅은 좌측 패널 및 상세 매체 탐색 과정에서도 지속적으로
              지원됩니다.
            </p>
          )}

          {mode === "search" ? (
            <div className="mt-[28px] flex w-full max-w-[860px] flex-col gap-[20px]">
              {SEARCH_SUGGESTIONS.map(({ title, items }) => (
                <section key={title} className="w-full text-center">
                  <h2 className="text-sm font-semibold text-black">{title}</h2>
                  <ul className="mt-[10px] flex flex-wrap justify-center gap-x-[10px] gap-y-[8px]">
                    {items.map((item) => (
                      <li key={item}>
                        <Button
                          variant="outline"
                          size="sm"
                          className={SUGGESTION_CHIP_CLASS}
                          onPress={() => setQuery(item)}
                        >
                          {item}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <ul className="mt-[28px] flex w-full max-w-[860px] flex-wrap justify-center gap-x-[10px] gap-y-[8px]">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={SUGGESTION_CHIP_CLASS}
                    onPress={() => setQuery(suggestion)}
                  >
                    {suggestion}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 아래에 콘텐츠가 더 있다는 표시 — 대화 중에도 유지한다. */}
      <div
        aria-hidden
        className={`flex shrink-0 flex-col items-center gap-[2px] text-[#888] ${
          hasConversation ? "mt-[12px]" : ""
        }`}
      >
        <ScrollMouseIcon className="size-[24px]" />
        <ChevronDownIcon className="size-[20px]" />
      </div>
    </div>
  );
}
