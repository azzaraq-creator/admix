"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import { useReactChat } from "@/hooks/adRecommendReact";

export type MixieChat = ReturnType<typeof useReactChat>;

type MixieChatContextValue = {
  chat: MixieChat;
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
};

const MixieChatContext = createContext<MixieChatContextValue | null>(null);

/**
 * 믹시 대화를 (main) 레이아웃에 한 벌만 둔다. 홈 화면과 사이드 패널이 같은 대화를
 * 보므로, 다른 메뉴로 갔다가 대시보드로 돌아와도 대화가 그대로 남는다.
 * (새로고침·재방문은 useReactChat의 세션 복원이 이어받는다.)
 */
export function MixieChatProvider({ children }: { children: ReactNode }) {
  const chat = useReactChat();
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <MixieChatContext.Provider value={{ chat, panelOpen, setPanelOpen }}>
      {children}
    </MixieChatContext.Provider>
  );
}

export function useMixieChat() {
  const value = useContext(MixieChatContext);
  if (!value)
    throw new Error("useMixieChat은 MixieChatProvider 안에서만 쓸 수 있어요.");
  return value;
}
