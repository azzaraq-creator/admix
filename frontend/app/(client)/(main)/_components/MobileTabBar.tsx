"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

import { useMenuLink } from "./menuNav";
import { MENU_ITEMS, type MenuItem } from "./Sidebar";
import { useMixieChat } from "./useMixieChat";

/** 대시보드 가이드에서 가운데 AI 믹시 버튼을 밝히는 단계 id(= data-tour 값). */
export const MIXIE_TAB_STEP_ID = "mobile-tab-mixie";

const TAB =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] text-[10px] leading-none";

function TabLink({ item }: { item: MenuItem }) {
  const { label, Icon, href, iconClassName } = item;
  // 켜짐 여부·누를 때 할 일(이미 그 화면이거나 가는 중이면 무시)은 사이드 메뉴와 같다(menuNav).
  const { active, onClick } = useMenuLink()(item);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={cn(
        TAB,
        active ? "font-bold text-white" : "font-medium text-white/55",
      )}
    >
      {/* 아이콘은 fill="currentColor"라 글자색을 그대로 따른다. */}
      <Icon className={cn("size-[20px] shrink-0", iconClassName)} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/**
 * 모바일 하단 탭 바 — 화면 아래에 떠 있는 반투명 남색 캡슐("지도 보기" 버튼과 같은 남색 68%, 유리처럼 뒤 본문이
 * 흐리게 비친다). 사이드 메뉴의 메뉴 넷(매체 찾기·기획안 | 관심 매체·
 * 문의하기)과 가운데 AI 믹시(회색 칸 속 믹시 심볼 + 글자, 누르면 어느 화면에서든 믹시 채팅 시트를 연다).
 * 본문 위에 떠 있어 스크롤하는 내용이 캡슐 뒤로 흐리게 비쳐 지나간다. 가리는 높이는 --tabbar-space(ClientShell)로
 * 알려 주고, 화면들이 스크롤 끝·"지도 보기" 같은 아래 버튼을 그만큼 올린다(globals.css·각 화면).
 */
export function MobileTabBar() {
  const { panelOpen, setPanelOpen } = useMixieChat();
  const [left, right] = [MENU_ITEMS.slice(0, 2), MENU_ITEMS.slice(2)];

  return (
    // z-[35]: 본문(매체 찾기 검색바 z-30)보다 위, 사이드 메뉴(z-40)·믹시 시트(z-50)보다는 아래.
    // 캡슐 둘레(좌우·아래 여백)는 눌러도 본문이 눌리게 비워 둔다(pointer-events-none).
    <nav
      aria-label="하단 메뉴"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[35] px-[12px] pb-[calc(8px+env(safe-area-inset-bottom))] sm:hidden"
    >
      {/* 캡슐 56px → 곡률 (56/2)-3 = 25px. 바탕이 흐리게 비치는 남색(gray-800 #252836, 40%) 유리. */}
      <div className="pointer-events-auto flex h-[56px] items-stretch rounded-[25px] bg-[rgba(37,40,54,0.4)] px-[6px] shadow-[0px_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[12px] backdrop-saturate-[1.6]">
        {left.map((item) => (
          <TabLink key={item.key} item={item} />
        ))}
        <button
          type="button"
          aria-label="AI 믹시"
          aria-expanded={panelOpen}
          data-mixie-toggle
          onClick={() => setPanelOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-center"
        >
          {/* 칸은 살짝 어두운 남색으로 깔아 가운데를 구분하고, 아이콘·글자만 선명한 연보라로 색 포인트를 준다 —
              밝은 칸 위의 연보라는 대비가 낮아 흐려 보여서(약 2.7:1), 칸을 어둡게 해 또렷하게 한다(약 6:1).
              46px → 곡률 (46/2)-3 = 20px. 켜진 상태는 따로 두지 않는다.
              심볼과 글자 위로는 연보라·하늘 빛이 천천히 흘러 살아 있는 AI 느낌을 준다(mixie-tab-shine, globals.css).
              심볼은 MixieIcon과 같은 모양을 마스크로 써서 그 빛 띠를 오려 낸다. */}
          <span
            data-tour={MIXIE_TAB_STEP_ID}
            className="flex h-[46px] w-full max-w-[60px] flex-col items-center justify-center gap-[3px] rounded-[20px] bg-[rgba(16,18,28,0.38)] text-[10px] leading-none font-bold"
          >
            <span
              aria-hidden
              className="mixie-tab-shine mixie-tab-shine-icon size-[18px] shrink-0"
            />
            <span className="mixie-tab-shine mixie-tab-shine-text truncate">
              AI 믹시
            </span>
          </span>
        </button>
        {right.map((item) => (
          <TabLink key={item.key} item={item} />
        ))}
      </div>
    </nav>
  );
}
