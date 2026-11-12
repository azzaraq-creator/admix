import type { Metadata } from "next";

import { AdvFavorites } from "../_components/advertiser/AdvFavorites";
import { AdvertiserOnly } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "관심 매장 | admix 콜라보",
};

/** 광고주 관심 매장 — 매장 찾기에서 하트를 누른 콜라보 매장(admix 관심 목록, 서버). 골라서 빼거나 바로 의뢰한다. */
export default function PartnersFavoritesPage() {
  return (
    <AdvertiserOnly>
      <AdvFavorites />
    </AdvertiserOnly>
  );
}
