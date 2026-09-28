import type { ReactNode } from "react";

import { LoginModal } from "./LoginModal";
import { MixieChatPanel } from "./MixieChatPanel";
import { MobileTopNav } from "./MobileTopNav";
import { Sidebar } from "./Sidebar";
import { MixieChatProvider } from "./useMixieChat";

/**
 * 사용자 화면 공통 틀 — LNB·AI 믹시 패널·모바일 상단바·로그인 창과, 이들이 함께 쓰는 믹시 대화.
 * (main)과 (mypage) 레이아웃이 같이 쓴다. 사이드바는 믹시 대화(MixieChatProvider)에 기대므로
 * 이 틀 밖에서 따로 쓰면 안 된다.
 */
export function ClientShell({ children }: { children: ReactNode }) {
  return (
    <MixieChatProvider>
      <div className="flex h-dvh w-full bg-white">
        <Sidebar />
        <MixieChatPanel />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopNav />
          <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
        <LoginModal />
      </div>
    </MixieChatProvider>
  );
}
