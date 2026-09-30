"use client";

import { Breadcrumbs, Button, ScrollShadow } from "@heroui/react";
import { useState } from "react";

import {
  ChevronDownIcon,
  InfoIcon,
  MixieIcon,
  ScrollMouseIcon,
  SearchDuotoneIcon,
} from "@/components/icons";

import { AiSearchBox } from "./AiSearchBox";
import { HomeChat } from "./HomeChat";
import { ModeToggle, type Mode } from "./ModeToggle";
import { NewChatButton } from "./NewChatButton";
import { useMixieChat } from "./useMixieChat";

const SUGGESTIONS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
  "500만원 이하 매체를 찾아주세요",
];

// 검색 모드는 자연어 질문 대신, 검색어로 그대로 넣을 수 있는 지역·매체명을 권한다.
// rows: 모바일에서 칩을 몇 줄로 나눠 좌우로 넘길지.
const SEARCH_SUGGESTIONS: { title: string; items: string[]; rows: 1 | 2 }[] = [
  {
    title: "추천 지역",
    rows: 1,
    items: ["강남", "홍대입구", "성수", "명동", "광화문"],
  },
  {
    title: "추천 매체",
    rows: 2,
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
// 모바일에선 긴 문구가 화면 밖으로 넘치지 않게 칩 안에서 줄바꿈한다.
const SUGGESTION_CHIP_CLASS =
  "max-w-full rounded-[13px] border-[#ececef] bg-white text-[#71717a] transition-colors hover:text-black max-sm:h-full max-sm:min-h-[36px] max-sm:w-full max-sm:justify-start max-sm:py-[8px] max-sm:text-left max-sm:text-[14px] max-sm:leading-[20px] max-sm:break-keep max-sm:whitespace-normal";

// 모바일은 칩 목록을 좌우로 넘기게 한다. 화면 끝까지 붙여(-mx) 다음 칩이
// 살짝 걸쳐 보이게 하고, 넘길 게 남은 쪽 가장자리는 흐리게(HeroUI ScrollShadow) 한다.
// 스크롤·그림자는 ScrollShadow가 맡고, 이 클래스는 여백·스냅만 준다.
const SUGGESTION_SCROLL_CLASS =
  "mt-[10px] max-sm:-mx-[20px] max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-[20px] max-sm:px-[20px]";
// 긴 문구는 240px 칸에 두 줄로 쌓아 넘기고,
const SUGGESTION_LIST_CLASS =
  "flex flex-wrap gap-x-[10px] gap-y-[8px] sm:justify-center max-sm:grid max-sm:auto-cols-[240px] max-sm:grid-flow-col max-sm:grid-rows-2";
const SUGGESTION_ITEM_CLASS = "max-w-full max-sm:snap-start";
// 검색 추천(지역·매체명)은 칩을 글자 폭 그대로 한 줄 문구로 두고, 모바일에선 줄마다
// 따로 흐르게 해 윗줄·아랫줄 칩 너비가 서로 맞춰지지 않게 한다. 데스크톱에선 줄
// 묶음(ul)을 contents로 풀어 기존처럼 한데 섞어 가운데로 감싼다.
const SEARCH_SUGGESTION_ROWS_CLASS = `${SUGGESTION_SCROLL_CLASS} flex flex-wrap gap-x-[10px] gap-y-[8px] sm:justify-center max-sm:flex-col max-sm:flex-nowrap`;
const SEARCH_SUGGESTION_ROW_CLASS =
  "flex gap-x-[10px] max-sm:w-max sm:contents";
const SEARCH_SUGGESTION_ITEM_CLASS = "shrink-0 sm:max-w-full max-sm:snap-start";
const SEARCH_SUGGESTION_CHIP_CLASS =
  "sm:max-w-full rounded-[13px] border-[#ececef] bg-white text-[#71717a] transition-colors hover:text-black max-sm:h-[36px] max-sm:px-[14px] max-sm:text-[14px]";

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
  // 대화 중에도 입력바의 전환 탭으로 검색 화면에 갈 수 있고, AI로 돌아오면 대화가 다시 보인다.
  const hasConversation = mode === "ai" && chat.messages.length > 0;

  return (
    // 첫 화면은 화면 높이를 꽉 채우고, 그 아래로 대시보드 콘텐츠가 이어진다(스크롤해서 본다).
    // 대화 중엔 높이를 화면에 고정해 대화 목록이 안에서 스크롤되고, 목록 끝에서 더 내리면
    // 바깥(홈 화면)이 이어서 스크롤돼 아래 콘텐츠가 보인다.
    <div
      className={`flex shrink-0 flex-col px-[20px] sm:px-[50px] ${
        hasConversation
          ? "h-full pb-[12px] sm:pb-[16px]"
          : "min-h-full pb-[24px]"
      }`}
    >
      <div className="relative flex shrink-0 items-center justify-between gap-[12px] pt-[16px] sm:pt-[52px]">
        <Breadcrumbs
          aria-label="현재 위치"
          separator="/"
          className="admix-breadcrumbs text-[13px] text-[#64748b]"
        >
          {/* 아직 이동할 대시보드 페이지가 없어 두 항목 모두 표시 전용이다. */}
          <Breadcrumbs.Item isDisabled>대시보드</Breadcrumbs.Item>
          <Breadcrumbs.Item isDisabled>{MODE_LABEL[mode]}</Breadcrumbs.Item>
        </Breadcrumbs>
        {/* 시안엔 없지만, 대화가 시작되면 처음 화면으로 돌아갈 길이 필요하다.
            패널은 헤더에 같은 버튼이 있다. PC는 브레드크럼과 같은 줄에 두되, 가운데 놓인
            채팅 영역(최대 860px)의 오른쪽 끝에 맞춘다. */}
        {hasConversation && (
          <div className="flex justify-end sm:pointer-events-none sm:absolute sm:inset-x-0 sm:top-[52px] sm:bottom-0 sm:mx-auto sm:max-w-[860px] sm:items-center">
            <div className="sm:pointer-events-auto">
              <NewChatButton />
            </div>
          </div>
        )}
      </div>

      {hasConversation ? (
        <div className="flex min-h-0 w-full flex-1 flex-col pt-[16px] sm:pt-[24px] sm:pb-[8px]">
          <HomeChat
            modeToggle={<ModeToggle value={mode} onChange={setMode} />}
          />
        </div>
      ) : (
        <div className="flex w-full flex-1 flex-col items-start justify-start py-[24px] sm:items-center sm:justify-center sm:py-[40px]">
          {/* 모바일은 아이콘 옆에 제목·부제를 두고, 데스크톱은 세로로 가운데 쌓는다. */}
          <div className="flex items-center gap-[12px] sm:flex-col sm:gap-0">
            {mode === "search" ? (
              <SearchDuotoneIcon className="size-[36px] shrink-0 sm:size-[70px]" />
            ) : (
              <MixieIcon className="size-[36px] shrink-0 sm:size-[70px] drop-shadow-[0_4px_12px_rgba(163,59,209,0.2)]" />
            )}
            <div className="flex flex-col sm:items-center">
              <h1 className="text-left text-[18px] leading-[26px] font-bold text-black sm:mt-[16px] sm:text-center sm:text-[36px] sm:leading-[1.5]">
                {TITLE[mode]}
              </h1>
              <p className="text-left text-[15px] leading-[22px] text-[#888] sm:mt-[12px] sm:text-center sm:text-base">
                {SUBTITLE[mode]}
              </p>
            </div>
          </div>

          {/* 모바일은 입력바가 남는 세로 공간을 채운다(최소 180px). */}
          <div className="mt-[20px] flex w-full justify-center max-sm:min-h-[180px] max-sm:flex-1">
            <AiSearchBox
              value={query}
              onValueChange={setQuery}
              mode={mode}
              onModeChange={setMode}
              onAiSubmit={(text) => chat.submit(text, { allowShort: true })}
            />
          </div>

          {mode === "ai" && (
            <p className="mt-[10px] max-w-[860px] text-left text-xs text-[#64748b] max-sm:text-[13px] max-sm:leading-[18px] sm:mt-[20px] sm:text-center">
              {/* 모바일은 좌측 패널이 없고 메뉴(드로어)로 들어간다. */}
              <span className="flex items-start gap-[4px] sm:hidden">
                {/* 글자(13px/18px) 첫 줄 가운데에 맞춰 2px 내린다. */}
                <InfoIcon
                  aria-hidden
                  className="mt-[2px] size-[14px] shrink-0"
                />
                메뉴의 AI 믹시에서 언제든 대화를 이어갈 수 있습니다.
              </span>
              <span className="hidden sm:inline">
                AI 믹시 채팅은 좌측 패널 및 상세 매체 탐색 과정에서도 지속적으로
                지원됩니다.
              </span>
            </p>
          )}

          {mode === "search" ? (
            <div className="mt-[20px] flex w-full max-w-[860px] flex-col gap-[20px] sm:mt-[28px]">
              {SEARCH_SUGGESTIONS.map(({ title, items, rows }) => {
                const half = Math.ceil(items.length / 2);
                const itemRows =
                  rows === 2
                    ? [items.slice(0, half), items.slice(half)]
                    : [items];
                return (
                  <section
                    key={title}
                    className="w-full text-left sm:text-center"
                  >
                    <h2 className="text-sm font-semibold text-black max-sm:text-[15px]">
                      {title}
                    </h2>
                    <ScrollShadow
                      orientation="horizontal"
                      hideScrollBar
                      size={24}
                      className={SEARCH_SUGGESTION_ROWS_CLASS}
                    >
                      {itemRows.map((row) => (
                        <ul
                          key={row[0]}
                          className={SEARCH_SUGGESTION_ROW_CLASS}
                        >
                          {row.map((item) => (
                            <li
                              key={item}
                              className={SEARCH_SUGGESTION_ITEM_CLASS}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className={SEARCH_SUGGESTION_CHIP_CLASS}
                                onPress={() => setQuery(item)}
                              >
                                {item}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      ))}
                    </ScrollShadow>
                  </section>
                );
              })}
            </div>
          ) : (
            <section className="mt-[20px] w-full max-w-[860px] text-left sm:mt-[28px] sm:text-center">
              <h2 className="text-[15px] font-semibold text-black sm:hidden">
                추천 질문
              </h2>
              {/* 스크롤 틀이 flex여야 오른쪽 여백까지 넘겨 볼 수 있다(모바일). */}
              <ScrollShadow
                orientation="horizontal"
                hideScrollBar
                size={24}
                className={`${SUGGESTION_SCROLL_CLASS} max-sm:flex sm:mt-0`}
              >
                <ul className={SUGGESTION_LIST_CLASS}>
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion} className={SUGGESTION_ITEM_CLASS}>
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
              </ScrollShadow>
            </section>
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
        <ScrollMouseIcon className="size-[18px] sm:size-[24px]" />
        <ChevronDownIcon className="size-[20px]" />
      </div>
    </div>
  );
}
