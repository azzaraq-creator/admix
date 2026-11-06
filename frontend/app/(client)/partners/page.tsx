import { cookies } from "next/headers";

import { USER_TOKEN_COOKIE } from "@/lib/userToken";

import { PartnersHome } from "./_components/PartnersHome";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>;
}) {
  // 로그인 쿠키가 있으면 회원 정보를 받는 동안 가입 유도 화면 대신 불러오는 중으로 둔다.
  const member = !!(await cookies()).get(USER_TOKEN_COOKIE)?.value;
  // ?intro=1 — 콜라보 안내 창의 "대시보드 보기". 회원 유형과 상관없이 소개 화면을 보여 준다.
  const intro = (await searchParams).intro === "1";
  return <PartnersHome member={member} intro={intro} />;
}
