import type { Metadata } from "next";

import { PartnersStoreDashboard } from "../_components/PartnersStoreDashboard";
import { PartnerOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "내 매장 | admix 콜라보",
};

/** 내 매장 — 매장 정보 보기 · 수정(제휴사 사이드바 "내 매장", 1인 1개). */
export default function PartnersStoresPage() {
  return (
    <PartnerOnly>
      <PartnersStoreDashboard />
    </PartnerOnly>
  );
}
