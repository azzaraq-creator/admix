import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { CurrentProposalPanel } from "./CurrentProposalPanel";
import { LoginModal } from "./LoginModal";
import { MixieChatPanel } from "./MixieChatPanel";
import { MobileTabBar } from "./MobileTabBar";
import { MobileTopNav } from "./MobileTopNav";
import { ShellContent } from "./ShellContent";
import { PageTourHost } from "@/components/common/PageTour";
import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { LNB_COLLAPSED_COOKIE } from "./lnbCookie";
import { Sidebar } from "./Sidebar";
import { LnbProvider } from "./useLnb";
import { MixieChatProvider } from "./useMixieChat";

/**
 * 사용자 화면 공통 틀 — LNB·AI 믹시 패널·모바일 상단바·로그인 창과, 이들이 함께 쓰는 믹시 대화.
 * (main)과 (mypage) 레이아웃이 같이 쓴다. 사이드바는 믹시 대화(MixieChatProvider)에 기대므로
 * 이 틀 밖에서 따로 쓰면 안 된다.
 * LNB 접힘 상태는 쿠키에서 읽어 서버가 첫 화면부터 그 모양으로 그린다(새로고침 때 펼쳤다 접히지 않게).
 */
export async function ClientShell({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const lnbCollapsed = cookieStore.get(LNB_COLLAPSED_COOKIE)?.value === "true";
  // 로그인 쿠키 — 회원 정보를 받는 동안 사이드바에 "로그인 / 회원가입"이 잠깐 보이지 않게 넘긴다.
  const member = !!cookieStore.get(USER_TOKEN_COOKIE)?.value;
  return (
    <LnbProvider initialCollapsed={lnbCollapsed}>
      <MixieChatProvider>
        <div className="flex h-dvh w-full bg-surface">
          <Sidebar member={member} />
          <MixieChatPanel />
          {/* --tabbar-space: 모바일 하단 탭 바가 본문 위에 떠서 가리는 높이(캡슐 56 + 아래 여백 8 + 안전 영역).
              화면들은 스크롤 끝·아래 버튼을 이만큼 올려 탭 바에 가리지 않게 한다(globals.css의 [data-shell-content]). */}
          <div className="relative flex min-w-0 flex-1 flex-col [--tabbar-space:calc(64px+env(safe-area-inset-bottom))] sm:[--tabbar-space:0px]">
            <MobileTopNav member={member} />
            <ShellContent>{children}</ShellContent>
            <MobileTabBar />
          </div>
          <LoginModal />
          <CurrentProposalPanel />
          <PageTourHost />
        </div>
      </MixieChatProvider>
    </LnbProvider>
  );
}
