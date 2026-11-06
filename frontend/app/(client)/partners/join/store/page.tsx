import type { Metadata } from "next";

import { PartnerStoreJoin } from "../../_components/PartnerStoreJoin";

export const metadata: Metadata = {
  title: "매장 등록 | admix 콜라보",
  description: "매장 정보를 입력하고 콜라보 가입을 마쳐요.",
};

/** 제휴사(콜라보) 가입 3단계 매장 등록 — 기본협약 동의의 계약서 단계에서 "다음 · 매장 등록"을 누르면 여기로 온다. */
export default function PartnerStoreJoinPage() {
  return <PartnerStoreJoin />;
}
