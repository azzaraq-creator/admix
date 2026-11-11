import type { Metadata } from "next";

import { AdvDashboard } from "../_components/advertiser/AdvDashboard";
import { PartnerDashboard } from "../_components/workspace/PartnerDashboard";
import { ByMember } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "대시보드 | admix 콜라보",
  description: "콜라보 대시보드",
};

/**
 * 콜라보 대시보드 — 제휴사(매장)는 매장 대시보드, 광고주는 확인할 일 · 진행 중 콜라보(지금은 예시 데이터).
 * admix 화면에서 제휴사 · 광고주로 콜라보에 들어오면 여기로 온다.
 */
export default function PartnersDashboardPage() {
  return <ByMember partner={<PartnerDashboard />} advertiser={<AdvDashboard />} />;
}
