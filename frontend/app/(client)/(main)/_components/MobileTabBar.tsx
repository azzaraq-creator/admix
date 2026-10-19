"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

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
        active ? "font-bold text-white" : "font-medium text-white/50",
      )}
    >
      {/* 아이콘은 fill="currentColor"라 글자색을 그대로 따른다. */}
      <Icon className={cn("size-[20px] shrink-0", iconClassName)} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

/** 바로 위 화면의 바탕색 — 캡슐 둘레를 같은 색으로 이어 칠해 경계선이 생기지 않게 한다. */
function backgroundAbove(nav: HTMLElement): string | null {
  const { top } = nav.getBoundingClientRect();
  // 왼쪽 끝 1px — 카드·버튼이 아닌 화면 여백일 가능성이 가장 높은 자리.
  let el = document.elementFromPoint(1, top - 1);
  while (el && el !== document.documentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== "transparent" && !bg.endsWith(", 0)")) return bg;
    el = el.parentElement;
  }
  return null;
}

/**
 * 모바일 하단 탭 바 — 화면 아래에 떠 있는 반투명 남색 캡슐("지도 보기" 버튼과 같은 남색, 82%). 사이드 메뉴의
 * 메뉴 넷(매체 찾기·기획안 | 관심 매체·문의하기)과 가운데 AI 믹시(옅은 칸 속 흰 심볼 + 글자, 누르면 어느
 * 화면에서든 믹시 채팅 시트를 연다).
 * 화면 틀의 세로 흐름 맨 아래에 두어 본문이 그만큼 줄어든다 — 본문 안 "지도 보기" 같은 아래 버튼은
 * 자연히 바 위에 뜬다. 캡슐 둘레는 바로 위 화면의 바탕색으로 칠한다(화면마다 연회색·흰색이 다르다).
 */
export function MobileTabBar() {
  const pathname = usePathname() ?? "";
  const { panelOpen, setPanelOpen, panelPreview } = useMixieChat();
  // 시트가 열렸거나(가이드 예시 포함) 홈(믹시 대화)이면 켜진 글자.
  const mixieActive = pathname === "/" || panelOpen || panelPreview === "shown";
  const [left, right] = [MENU_ITEMS.slice(0, 2), MENU_ITEMS.slice(2)];

  const navRef = useRef<HTMLElement>(null);
  const [surround, setSurround] = useState<string | null>(null);
  // 화면을 옮기면 새 화면이 그려진 뒤(불러오는 중 화면이 바뀌는 것까지) 다시 잰다.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => setSurround(backgroundAbove(nav));
    const frame = requestAnimationFrame(measure);
    const timers = [300, 1000].map((ms) => setTimeout(measure, ms));
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
      window.removeEventListener("resize", measure);
    };
  }, [pathname]);

  return (
    // z-[35]: 본문(매체 찾기 검색바 z-30)보다 위, 사이드 메뉴(z-40)·믹시 시트(z-50)보다는 아래.
    <nav
      ref={navRef}
      aria-label="하단 메뉴"
      className="relative z-[35] shrink-0 px-[12px] pt-[4px] pb-[calc(8px+env(safe-area-inset-bottom))] sm:hidden"
      style={{ backgroundColor: surround ?? undefined }}
    >
      {/* 캡슐 56px → 곡률 (56/2)-3 = 25px. 바탕이 살짝 비치는 남색(gray-800 #252836, 82%). */}
      <div className="flex h-[56px] items-stretch rounded-[25px] bg-[rgba(37,40,54,0.82)] px-[6px] shadow-[0px_6px_18px_rgba(0,0,0,0.18)] backdrop-blur-[12px] backdrop-saturate-[1.6]">
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
          {/* 아이콘과 글자를 옅은 칸 하나에 담아 가운데를 구분한다 — 46px → 곡률 (46/2)-3 = 20px.
              시트가 열렸거나 홈이면 칸이 조금 더 밝아진다. */}
          <span
            data-tour={MIXIE_TAB_STEP_ID}
            className={cn(
              "flex h-[46px] w-full max-w-[60px] flex-col items-center justify-center gap-[3px] rounded-[20px] text-[10px] leading-none font-bold text-white",
              mixieActive ? "bg-white/25" : "bg-white/15",
            )}
          >
            <MixieIcon
              aria-hidden
              className="size-[18px] shrink-0 [&_path]:fill-white"
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
