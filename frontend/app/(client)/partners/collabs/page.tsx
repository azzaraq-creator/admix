import type { Metadata } from "next";

import { AdvCollabList } from "../_components/advertiser/AdvCollabList";
import { CollabBoard } from "../_components/workspace/CollabBoard";
import { ByMember } from "../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "콜라보 | admix 콜라보",
  description: "콜라보 목록 · 모집 중인 콜라보",
};

/**
 * 콜라보 목록 (지금은 예시 데이터).
 * 제휴사: ?tab=recruiting|upcoming|ongoing|done · 광고주(내 콜라보): ?tab=request|matching|running|done.
 */
export default async function PartnersCollabsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  return (
    <ByMember
      partner={<CollabBoard />}
      advertiser={<AdvCollabList tab={tab} />}
    />
  );
}
