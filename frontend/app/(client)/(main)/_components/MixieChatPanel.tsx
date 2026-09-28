"use client";

import { useEffect, useRef } from "react";

import { MixieIcon, XIcon } from "@/components/icons";

import { cn } from "@/lib/utils";

import { HomeChat } from "./HomeChat";
import { NewChatButton } from "./NewChatButton";
import { useLnbCollapsed } from "./useLnb";
import { useMixieChat } from "./useMixieChat";

/**
 * LNB의 "AI 믹시"로 여닫는 대화 패널. (main) 레이아웃에 붙어 있어 어느 화면에서든
 * 열 수 있고, 홈과 같은 대화를 공유한다. 데스크톱은 LNB 오른쪽에 본문 위로 겹쳐 뜨고,
 * 모바일은 화면 전체를 덮는다.
 */
/**
 * 바깥 클릭으로 보지 않을 요소 — LNB의 "AI 믹시" 버튼과, 패널에서 연 창들.
 * - dialog-*: shadcn/base-ui 다이얼로그(제안서 담기 등)
 * - modal-backdrop / alert-dialog-backdrop: HeroUI Modal(로그인)·AlertDialog("새 대화" 확인창).
 *   배경이 창 전체를 감싸서 창 안 버튼이든 배경이든 모두 걸러진다.
 */
const PANEL_PART_SELECTOR = [
  "[data-mixie-toggle]",
  '[data-slot^="dialog"]',
  '[data-slot="modal-backdrop"]',
  '[data-slot="alert-dialog-backdrop"]',
].join(", ");

export function MixieChatPanel() {
  const { chat, panelOpen, setPanelOpen } = useMixieChat();
  const panelRef = useRef<HTMLElement>(null);
  // 데스크톱에서 LNB가 접히면(78px) 패널도 그 오른쪽에 붙는다.
  const lnbCollapsed = useLnbCollapsed();

  // 패널 바깥(다른 메뉴·본문·지도 등)을 누르면 닫는다. 캡처 단계에서 들어 지도처럼
  // 자체적으로 이벤트 전파를 막는 곳을 눌러도 닫히게 한다. 단, LNB의 "AI 믹시" 버튼은
  // 자기 onClick으로 여닫고, 패널에서 연 모달(제안서 담기·로그인)은 패널의 일부로 본다.
  useEffect(() => {
    if (!panelOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target || panelRef.current?.contains(target)) return;
      if (target.closest(PANEL_PART_SELECTOR)) return;
      setPanelOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [panelOpen, setPanelOpen]);

  return (
    <aside
      ref={panelRef}
      aria-label="AI 믹시 대화"
      aria-hidden={!panelOpen}
      inert={!panelOpen}
      // 모바일은 화면 전체를 덮고(페이드), 데스크톱은 LNB 뒤에서 미끄러져 나와 본문 위에
      // 뜬다 — 본문 폭은 그대로라 열고 닫아도 화면이 밀리지 않는다.
      // 데스크톱 z-35: 본문의 가장 높은 층(매체 찾기 검색바 z-30)보다 위, 그 뒤로 미끄러져
      // 나오는 LNB(z-40)보다는 아래.
      className={cn(
        "fixed inset-0 z-50 flex flex-col bg-white transition-[opacity,translate,left] duration-300 ease-in-out sm:inset-y-0 sm:right-auto sm:z-[35] sm:w-[400px] sm:border-r sm:border-black-200 sm:opacity-100 sm:shadow-[4px_0_16px_0_rgba(0,0,0,0.08)]",
        lnbCollapsed ? "sm:left-[78px]" : "sm:left-[180px]",
        panelOpen
          ? "opacity-100 sm:translate-x-0"
          : "pointer-events-none opacity-0 sm:-translate-x-full sm:shadow-none",
      )}
    >
      <div className="flex h-full w-full min-h-0 flex-col">
        <div className="flex h-[56px] shrink-0 items-center justify-between border-b border-black-200 bg-white px-[16px]">
          <div className="flex items-center gap-[8px]">
            <MixieIcon className="size-[18px] shrink-0" />
            {/* 패널 안은 보라가 이미 많아 제목은 그라데이션 없이 기본 글자색 단색으로 둔다. */}
            <span className="text-[15px] font-semibold text-black-900">
              AI 믹시
            </span>
          </div>
          <div className="flex items-center gap-[12px]">
            {chat.messages.length > 0 && (
              <NewChatButton />
            )}
            <button
              type="button"
              aria-label="AI 믹시 닫기"
              onClick={() => setPanelOpen(false)}
              className="flex size-[28px] items-center justify-center rounded-[8px] text-black-500 transition-colors hover:bg-black-50 hover:text-black"
            >
              <XIcon className="size-[16px]" />
            </button>
          </div>
        </div>
        {/* 대화 영역은 옅은 회색으로 깔아 흰 말풍선이 떠 보이게 한다. */}
        <div className="flex min-h-0 flex-1 flex-col bg-black-50 pt-[16px]">
          <HomeChat variant="panel" />
        </div>
      </div>
    </aside>
  );
}
