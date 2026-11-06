import type { Metadata } from "next";

import { PartnerHistory } from "../_components/workspace/PartnerHistory";

export const metadata: Metadata = {
  title: "참여 이력 | admix 콜라보",
};

/** 참여 이력 — ?status=active|scheduled|completed|inactive (지금은 예시 데이터). */
export default async function PartnersHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <PartnerHistory status={status} />;
}
