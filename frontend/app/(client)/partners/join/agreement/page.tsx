import type { Metadata } from "next";
import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnerAgreement } from "../../_components/PartnerAgreement";

export const metadata: Metadata = {
  title: "기본협약 동의 | admix 콜라보",
  description: "기본협약 핵심 내용 5가지를 확인하고 동의해요.",
};

/**
 * 제휴사(콜라보) 기본협약 동의 — 가입·협약 소개(/partners/join)에서 "가입·협약 시작하기"를 누르면 여기로 온다.
 * 사이드바 메뉴 "기본 협약"은 ?from=menu 로 들어온다 — 가입 진행의 03 매장 연결이 연결 여부 체크로, "대시보드로" 버튼 없음.
 */
export default async function PartnerAgreementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  // 로그인 쿠키가 있으면 회원 정보 · 진행 상태를 받는 동안 처음 화면 대신 로딩을 그린다(서버 화면부터).
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  const { from } = await searchParams;
  return <PartnerAgreement member={member} fromMenu={from === "menu"} />;
}
