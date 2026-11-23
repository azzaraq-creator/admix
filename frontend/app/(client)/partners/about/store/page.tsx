import type { Metadata } from "next";
import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnersAboutStore } from "../../_components/PartnersAboutStore";

export const metadata: Metadata = {
  title: "매장 참여 방법 | admix 콜라보",
  description: "매장 가입 절차와 콜라보 참여 순서를 안내합니다.",
};

/** 콜라보 소개 하위 — 매장 참여 방법(11-23). 누구나 본다. 로그인 쿠키는 시작 버튼(가입 · 유형 바꾸기)을 고르는 데만 쓴다. */
export default async function PartnersAboutStorePage() {
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return <PartnersAboutStore member={member} />;
}
