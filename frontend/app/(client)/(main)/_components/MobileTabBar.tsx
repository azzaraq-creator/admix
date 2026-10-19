"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MixieIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { MENU_ITEMS, type MenuItem } from "./Sidebar";
import { useMixieChat } from "./useMixieChat";

/** 대시보드 가이드에서 가운데 AI 믹시 버튼을 밝히는 단계 id(= data-tour 값). */
export const MIXIE_TAB_STEP_ID = "mobile-tab-mixie";

const TAB =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-[4px] text-[10px] leading-none";

function TabLink({ item, pathname }: { item: MenuItem; pathname: string }) {
  const { label, Icon, href, alsoActiveOn, iconClassName } = item;
  const active = [href, ...(alsoActiveOn ?? [])].some((path) =>
    pathname.startsWith(path),
  );
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
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
 * 모바일 하단 탭 바 — 화면 아래에 떠 있는 반투명 남색 캡슐("지도 보기" 버튼과 같은 남색 82%, 유리처럼 뒤 본문이
 * 흐리게 비친다). 사이드 메뉴의 메뉴 넷(매체 찾기·기획안 | 관심 매체·
 * 문의하기)과 가운데 AI 믹시(회색 칸 속 믹시 심볼 + 글자, 누르면 어느 화면에서든 믹시 채팅 시트를 연다).
 * 본문 위에 떠 있어 스크롤하는 내용이 캡슐 뒤로 흐리게 비쳐 지나간다. 가리는 높이는 --tabbar-space(ClientShell)로
 * 알려 주고, 화면들이 스크롤 끝·"지도 보기" 같은 아래 버튼을 그만큼 올린다(globals.css·각 화면).
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const { panelOpen, setPanelOpen, panelPreview } = useMixieChat();
  // 시트가 열렸거나(가이드 예시 포함) 홈(믹시 대화)이면 켜진 글자.
  const mixieActive = pathname === "/" || panelOpen || panelPreview === "shown";
  const [left, right] = [MENU_ITEMS.slice(0, 2), MENU_ITEMS.slice(2)];

  return (
    // z-[35]: 본문(매체 찾기 검색바 z-30)보다 위, 사이드 메뉴(z-40)·믹시 시트(z-50)보다는 아래.
    // 캡슐 둘레(좌우·아래 여백)는 눌러도 본문이 눌리게 비워 둔다(pointer-events-none).
    <nav
      aria-label="하단 메뉴"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[35] px-[12px] pb-[calc(8px+env(safe-area-inset-bottom))] sm:hidden"
    >
      {/* 캡슐 56px → 곡률 (56/2)-3 = 25px. 바탕이 흐리게 비치는 남색(gray-800 #252836, 82%) 유리. */}
      <div className="pointer-events-auto flex h-[56px] items-stretch rounded-[25px] bg-[rgba(37,40,54,0.82)] px-[6px] shadow-[0px_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[12px] backdrop-saturate-[1.6]">
        {left.map((item) => (
          <TabLink key={item.key} item={item} pathname={pathname} />
        ))}
        <button
          type="button"
          aria-label="AI 믹시"
          aria-expanded={panelOpen}
          data-mixie-toggle
          onClick={() => setPanelOpen(true)}
          className="flex min-w-0 flex-1 items-center justify-center"
        >
          {/* 아이콘과 글자를 옅은 칸 하나에 담아 가운데를 구분하고, 둘만 연보라로 색 포인트를 준다
              (남색 위에서 또렷하게 — 믹시 보라보다 밝은 톤). 46px → 곡률 (46/2)-3 = 20px.
              시트가 열렸거나 홈이면 칸이 조금 더 밝아진다. */}
          <span
            data-tour={MIXIE_TAB_STEP_ID}
            className={cn(
              "flex h-[46px] w-full max-w-[60px] flex-col items-center justify-center gap-[3px] rounded-[20px] text-[10px] leading-none font-bold text-[#c9b8f7]",
              mixieActive ? "bg-white/20" : "bg-white/12",
            )}
          >
            <MixieIcon
              aria-hidden
              className="size-[18px] shrink-0 [&_path]:fill-[#c2adf8]"
            />
            <span className="truncate">AI 믹시</span>
          </span>
        </button>
        {right.map((item) => (
          <TabLink key={item.key} item={item} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
