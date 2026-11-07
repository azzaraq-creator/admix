import type { Metadata } from "next";

import { HelpView } from "@/app/(client)/(main)/help/_components/HelpView";

export const metadata: Metadata = {
  title: "약관 및 정책 | admix 콜라보",
};

// 탭을 주소(?tab=)에서 읽으므로 요청마다 그린다(admix /help 와 같다).
export const dynamic = "force-dynamic";

/**
 * 콜라보 화면의 약관 및 정책 — admix 약관 및 정책(/help)과 같은 화면(HelpView)을 콜라보 사이드바 안에서 보여 준다.
 * 콜라보 사이드바 프로필 메뉴의 "약관 및 정책"이 여기로 온다(admix 화면으로 넘어가지 않게, /partners/profile 과 같다).
 */
export default function PartnersHelpPage() {
  return <HelpView basePath="/partners/help" embedded />;
}
