import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { LoginModal } from "@/app/(client)/(main)/_components/LoginModal";
import { LNB_COLLAPSED_COOKIE } from "@/app/(client)/(main)/_components/lnbCookie";
import { LnbProvider } from "@/app/(client)/(main)/_components/useLnb";

import { PartnerResumeModal } from "./_components/PartnerResumeModal";
import { PartnersSidebar } from "./_components/PartnersSidebar";

export const metadata: Metadata = {
  title: "콜라보 | admix",
  description: "매장과 광고주를 잇는 admix 콜라보",
};

/**
 * 콜라보 — /admin 처럼 주소로 바로 들어오는 별도 화면(새 탭으로 열리고, admix와 같은 모양의 콜라보 전용 사이드바를 쓴다).
 * 매장에 가입을 권할 때 이 주소(/partners)를 그대로 보내므로 비회원도 들어와 예시 화면을 본다.
 */
export default async function PartnersLayout({
  children,
}: {
  children: ReactNode;
}) {
  // 로그인 쿠키가 있는지 — 있으면 회원 정보를 받는 동안 "로그인/회원가입" 대신 빈칸으로 둔다(ClientShell과 같다).
  const cookieStore = await cookies();
  const member = !!cookieStore.get(USER_TOKEN_COOKIE)?.value;
  // 사이드바 접힘 — admix와 같은 쿠키를 읽어 첫 화면부터 접힌 모양으로 그린다(ClientShell과 같다).
  const lnbCollapsed = cookieStore.get(LNB_COLLAPSED_COOKIE)?.value === "true";
  return (
    // admix와 같은 틀 — 왼쪽 사이드바 + 오른쪽 본문(본문만 스크롤). 모바일은 위 띠 + 드로어.
    <LnbProvider initialCollapsed={lnbCollapsed}>
      {/* partners-ui — 다크 모드에서 흐린 회색 글자를 조금 밝히는 범위(globals.css). */}
      <div className="partners-ui flex h-dvh w-full flex-col bg-gray-50 sm:flex-row">
        <PartnersSidebar member={member} />
        {/*
         * relative — 화면이 본문 전체에 배경을 깔 수 있게(가입 · 협약 화면의 배경 빛).
         * 모든 콜라보 화면에 같은 빛을 깔아 봤다가(11-08) "배경 그라데이션은 빼는 게 좋겠다"고 해서 되돌렸다.
         */}
        <main className="relative min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1120px] flex-col px-[16px] py-[20px] sm:px-[24px] sm:py-[32px]">
            {children}
          </div>
        </main>
        {/* 로그인 · 회원가입 창 — admix와 같은 창의 콜라보 모양(Collaboration 로고 · 간편 로그인 없음 · 가입은 /partners/join). */}
        <LoginModal variant="partners" />
        <PartnerResumeModal />
      </div>
    </LnbProvider>
  );
}
