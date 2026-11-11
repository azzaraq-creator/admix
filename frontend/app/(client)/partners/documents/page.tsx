import type { Metadata } from "next";

import {
  ByMember,
  PartnerRedirect,
} from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "문서함 | admix 콜라보",
};

/**
 * 문서함은 없앴다(2026-11-09 사용자) — 예전 주소로 오면 옮긴 자리로 보낸다.
 * 제휴사: 참여 이력(콜라보마다 확정서) · 광고주: 내 콜라보(콜라보 상세의 "문서" 칸에 계산서 · 보고서).
 */
export default function PartnersDocumentsPage() {
  return (
    <ByMember
      partner={<PartnerRedirect href="/partners/history" />}
      advertiser={<PartnerRedirect href="/partners/collabs" />}
    />
  );
}
