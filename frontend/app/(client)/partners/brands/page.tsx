import type { Metadata } from "next";

import { AdvBrands } from "../_components/advertiser/AdvBrands";
import { AdvertiserOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "내 브랜드 | admix 콜라보",
};

/**
 * 광고주 내 브랜드 — 브랜드 여러 개(이름 · 사진)를 등록해 두고 의뢰서에서 고른다(실제 데이터, 068).
 * ?new=1 이면 들어오자마자 브랜드 등록 창을 연다(브랜드 없이 "새 콜라보 의뢰"를 누른 때, 11-11 사용자).
 */
export default async function PartnersBrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: openNew } = await searchParams;
  return (
    <AdvertiserOnly>
      <AdvBrands openNew={openNew === "1"} />
    </AdvertiserOnly>
  );
}
