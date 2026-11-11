import type { Metadata } from "next";

import {
  ByMember,
  PartnerRedirect,
} from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "대화 | admix 콜라보",
};

/** 대화는 없앴다(2026-11-09 사용자, 제휴사 · 광고주 모두) — 예전 주소로 오면 대시보드로. */
export default function PartnersMessagesPage() {
  return (
    <ByMember
      partner={<PartnerRedirect href="/partners/dashboard" />}
      advertiser={<PartnerRedirect href="/partners/dashboard" />}
    />
  );
}
