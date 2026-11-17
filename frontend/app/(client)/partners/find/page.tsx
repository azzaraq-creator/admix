import type { Metadata } from "next";

import { AdvStoreFinder } from "../_components/advertiser/AdvStoreFinder";
import { AdvertiserOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "매장 찾기 | admix 콜라보",
};

/** 광고주 매장 찾기 — 실제 콜라보 매장(등급 · 금액)을 둘러보고 담는다. */
export default function PartnersFindPage() {
  return (
    // 승인 전 광고주도 매장 찾기는 본다 — 카드는 눌리지 않고 금액 · 가능 범위가 흐리다(11-17 사용자).
    <AdvertiserOnly allowUnverified>
      <AdvStoreFinder />
    </AdvertiserOnly>
  );
}
