import type { Metadata } from "next";

import { PartnerDashboard } from "../_components/workspace/PartnerDashboard";

export const metadata: Metadata = {
  title: "대시보드 | admix 콜라보",
  description: "제휴사(콜라보) 매장 대시보드",
};

/** 제휴사(콜라보) 매장 대시보드 — admix 화면에서 제휴사로 로그인하면 여기로 온다(지금은 예시 데이터). */
export default function PartnersDashboardPage() {
  return <PartnerDashboard />;
}
