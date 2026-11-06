import type { Metadata } from "next";

import { COLLAB_CATEGORIES } from "@/lib/partnersPreview";

import { CollabBoard } from "../_components/workspace/CollabBoard";

export const metadata: Metadata = {
  title: "콜라보 | admix 콜라보",
  description: "모집 중 · 예정 · 진행 중 · 완료 콜라보",
};

/** 콜라보 목록 — ?tab=recruiting|upcoming|ongoing|done (지금은 예시 데이터). */
export default async function PartnersCollabsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const segment = COLLAB_CATEGORIES.find((c) => c === tab);
  return <CollabBoard tab={segment} />;
}
