import type { Metadata } from "next";

import { AdvStoreFinder } from "../_components/advertiser/AdvStoreFinder";
import { AdvertiserOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "매장 찾기 | admix 콜라보",
};

/** 광고주 매장 찾기 — 실제 콜라보 매장(등급 · 금액)을 둘러보고 담는다. */
export default function PartnersFindPage() {
  return (
    <AdvertiserOnly>
      <AdvStoreFinder />
    </AdvertiserOnly>
  );
}
