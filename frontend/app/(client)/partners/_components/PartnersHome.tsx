"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import { useHasUserToken, useMe } from "@/hooks/auth";
import { PARTNERS_DASHBOARD_HREF } from "@/lib/partners";

import { PartnersLanding } from "./PartnersLanding";
import { PartnersNoAccess } from "./PartnersNoAccess";

/**
 * /partners 첫 화면 — 회원 유형에 따라 갈린다.
 * - 비회원: 가입을 권하는 소개 + 예시 화면(매장에 보내는 링크가 이 주소다)
 * - 제휴사(콜라보): 대시보드(/partners/dashboard)로 보낸다 — admix 홈 Collaboration 메뉴도 대시보드로(11-08 사용자).
 *   협약 전 · 매장 연결 전이면 대시보드가 모집 중 콜라보와 다음 할 일을 안내한다(StartGate). 내 매장은 사이드바 "내 매장"(/partners/stores).
 * - 광고주: 대시보드(/partners/dashboard)로 — 의뢰한 콜라보 · 할 일(2026-11-09). 매장 찾기는 /partners/find.
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
  const router = useRouter();
  const { data: me, isError } = useMe();
  const hasToken = useHasUserToken(member);
  // 제휴사 · 광고주는 대시보드로.
  const partner =
    !intro &&
    (me?.member_category === "partner" || me?.member_category === "advertiser");

  useEffect(() => {
    if (partner) router.replace(PARTNERS_DASHBOARD_HREF);
  }, [partner, router]);

  // 소개는 회원 정보를 기다리지 않는다 — 가입 버튼 대신 무엇을 보여 줄지만 회원 정보로 고른다.
  if (intro) return <PartnersLanding member={!!me} />;
  // 회원 정보를 받는 중이거나, 제휴사라 대시보드로 옮겨 가는 중.
  if ((hasToken && !me && !isError) || partner) {
    return <LoadingState />;
  }
  if (!me) return <PartnersLanding />;
  return <PartnersNoAccess />;
}
