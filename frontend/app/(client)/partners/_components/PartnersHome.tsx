"use client";

import { Spinner } from "@heroui/react";

import { useHasUserToken, useMe } from "@/hooks/auth";

import { AdvertiserPartnersDashboard } from "./AdvertiserPartnersDashboard";
import { PartnersLanding } from "./PartnersLanding";
import { PartnersNoAccess } from "./PartnersNoAccess";
import { PartnersStoreDashboard } from "./PartnersStoreDashboard";

/**
 * /partners 첫 화면 — 회원 유형에 따라 갈린다.
 * - 비회원: 가입을 권하는 소개 + 예시 화면(매장에 보내는 링크가 이 주소다)
 * - 제휴사(콜라보): 매장 대시보드(첫 입장이면 매장 등록)
 * - 광고주: 콜라보할 매장 찾기
 * - 그 외(일반·대행사·매체사): 이용 안내
 * - intro(?intro=1, 콜라보 안내 창의 "대시보드 보기"): 누구든 소개 + 예시 화면
 */
export function PartnersHome({
  member = false,
  intro = false,
}: {
  member?: boolean;
  intro?: boolean;
}) {
  const { data: me, isError } = useMe();
  const hasToken = useHasUserToken(member);

  // 소개는 회원 정보를 기다리지 않는다 — 가입 버튼 대신 무엇을 보여 줄지만 회원 정보로 고른다.
  if (intro) return <PartnersLanding member={!!me} />;
  if (hasToken && !me && !isError) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!me) return <PartnersLanding />;
  if (me.member_category === "partner") return <PartnersStoreDashboard />;
  if (me.member_category === "advertiser")
    return <AdvertiserPartnersDashboard />;
  return <PartnersNoAccess />;
}
