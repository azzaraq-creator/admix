import type { Metadata } from "next";
import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnersAboutBrand } from "../../_components/PartnersAboutBrand";

export const metadata: Metadata = {
  title: "브랜드 협업 구성 | admix 콜라보",
  description:
    "매장에서 할 수 있는 콜라보 구성 · 준비 방식 · 모집 일정 · 진행 순서를 안내합니다.",
};

/** 콜라보 소개 하위 — 브랜드 협업 구성(11-23). 누구나 본다. 로그인 쿠키는 시작 버튼(가입 · 유형 바꾸기)을 고르는 데만 쓴다. */
export default async function PartnersAboutBrandPage() {
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  return <PartnersAboutBrand member={member} />;
}
