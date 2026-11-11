import type { Metadata } from "next";

import { AdvRequestForm } from "../../_components/advertiser/AdvRequestForm";
import { AdvertiserOnly } from "../../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "콜라보 의뢰 | admix 콜라보",
};

/** 광고주 콜라보 의뢰서 — ?edit=id 면 검토 중 · 보완 요청 의뢰 고치기(지금은 예시 데이터, 이 탭에만 남는다). */
export default async function PartnersCollabRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  return (
    <AdvertiserOnly>
      <AdvRequestForm editId={edit} />
    </AdvertiserOnly>
  );
}
