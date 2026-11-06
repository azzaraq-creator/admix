import type { Metadata } from "next";

import { PartnerJoin } from "../_components/PartnerJoin";

export const metadata: Metadata = {
  title: "가입·협약 | admix 콜라보",
  description: "제휴사(콜라보)로 가입하고 기본협약을 확인한 뒤 함께 시작해요.",
};

/** 제휴사(콜라보) 가입·협약 소개 — "시작하기"는 로그인 전이면 이메일 가입, 제휴사로 로그인했으면 기본협약 동의로 보낸다. */
export default function PartnerJoinPage() {
  return <PartnerJoin />;
}
