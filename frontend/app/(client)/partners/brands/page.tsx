import type { Metadata } from "next";

import { AdvBrands } from "../_components/advertiser/AdvBrands";
import { AdvertiserOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "내 브랜드 | admix 콜라보",
};

/** 광고주 내 브랜드 — 브랜드 여러 개(이름 · 사진)를 등록해 두고 의뢰서에서 고른다(실제 데이터, 068). */
export default function PartnersBrandsPage() {
  return (
    <AdvertiserOnly>
      <AdvBrands />
    </AdvertiserOnly>
  );
}
