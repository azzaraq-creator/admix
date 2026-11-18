import type { Metadata } from "next";
import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnerAgreement } from "../../_components/PartnerAgreement";

export const metadata: Metadata = {
  title: "협약서 작성 | admix 콜라보",
  description: "협약 내용을 확인하고 전자 서명으로 협약서를 작성해요.",
};

/**
 * 제휴사(콜라보) 협약서 작성 — 가입을 마치면 여기로 온다. 사이드바 메뉴와 따로인 화면(2026-11-18 사용자).
 * 이미 작성한 제휴사는 사이드바 "협약서"(/partners/agreement — 작성한 협약서 보기 · 내려받기)로 보낸다.
 */
export default async function PartnerAgreementPage() {
  // 로그인 쿠키가 있으면 회원 정보 · 진행 상태를 받는 동안 처음 화면 대신 로딩을 그린다(서버 화면부터).
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return <PartnerAgreement member={member} />;
}
