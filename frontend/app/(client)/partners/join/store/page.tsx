import type { Metadata } from "next";

import { PartnerStoreLink } from "../../_components/PartnerStoreLink";

export const metadata: Metadata = {
  title: "매장 연결 | admix 콜라보",
  description: "매장 ID로 연결을 요청하거나, 담당자에게 매장 등록을 맡겨요.",
};

/**
 * 가입 03 매장 연결 — 기본협약 동의의 "완료하기" 다음(2026-11-17).
 * 예전엔 매장 등록(가입 03) 주소였다가 대시보드로 돌려보냈다(069) — 지금은 매장 ID로 연결 요청하는 화면.
 */
export default function PartnerStoreJoinPage() {
  return <PartnerStoreLink />;
}
