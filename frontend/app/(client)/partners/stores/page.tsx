import type { Metadata } from "next";

import { PartnersStoreDashboard } from "../_components/PartnersStoreDashboard";
import { PartnerOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "매장 관리 | admix 콜라보",
};

/** 매장 관리 — 내 매장 목록 · 추가 · 수정(제휴사 사이드바 "매장 관리"). */
export default function PartnersStoresPage() {
  return (
    <PartnerOnly>
      <PartnersStoreDashboard />
    </PartnerOnly>
  );
}
