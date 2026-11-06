import type { Metadata } from "next";

import { CollabDetail } from "../../_components/workspace/CollabDetail";

export const metadata: Metadata = {
  title: "콜라보 상세 | admix 콜라보",
};

/** 콜라보 상세 · 진행 안내함 (지금은 예시 데이터). */
export default async function PartnersCollabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CollabDetail id={decodeURIComponent(id)} />;
}
