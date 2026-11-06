import type { Metadata } from "next";

import { ProfileView } from "@/app/(client)/(mypage)/profile/_components/ProfileView";

export const metadata: Metadata = {
  title: "내 정보 | admix 콜라보",
};

/**
 * 콜라보 화면의 내 정보 — admix 내 정보(/profile)와 같은 화면(ProfileView)을 콜라보 사이드바 안에서 보여 준다.
 * 콜라보 사이드바 프로필 메뉴의 "내 정보"가 여기로 온다(admix 화면으로 넘어가지 않게).
 */
export default function PartnersProfilePage() {
  return <ProfileView />;
}
