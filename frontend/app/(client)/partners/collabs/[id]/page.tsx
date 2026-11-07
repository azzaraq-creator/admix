import type { Metadata } from "next";

import { CollabDetail } from "../../_components/workspace/CollabDetail";

export const metadata: Metadata = {
  title: "콜라보 상세 | admix 콜라보",
};

/**
 * 콜라보 상세 · 진행 안내함 (지금은 예시 데이터).
 * 콜라보 목록 밖(대시보드 · 알림 · 참여 이력 · 문서함)에서 열면 ?from= 이 붙어 맨 위 버튼이 "뒤로가기"가 된다.
 */
export default async function PartnersCollabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  return <CollabDetail id={decodeURIComponent(id)} from={from} />;
}
