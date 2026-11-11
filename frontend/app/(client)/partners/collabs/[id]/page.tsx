import type { Metadata } from "next";

import { AdvCollabDetail } from "../../_components/advertiser/AdvCollabDetail";
import { CollabDetail } from "../../_components/workspace/CollabDetail";
import { ByMember } from "../../_components/workspace/workspaceUi";

export const metadata: Metadata = {
  title: "콜라보 상세 | admix 콜라보",
};

/**
 * 콜라보 상세 (지금은 예시 데이터) — 제휴사는 진행 안내함, 광고주는 신청 매장 · 확정 · 계산서 · 보고서.
 * 목록 밖(대시보드 · 알림 · 참여 이력 · 문서함)에서 열면 ?from= 이 붙어 맨 위 버튼이 "뒤로가기"가 된다.
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
  const key = decodeURIComponent(id);
  return (
    <ByMember
      partner={<CollabDetail id={key} from={from} />}
      advertiser={<AdvCollabDetail id={key} from={from} />}
    />
  );
}
