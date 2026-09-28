import { redirect } from "next/navigation";

// 개인/기업 구분 가입은 없어졌다 — 회원 유형 선택부터 시작하는 새 흐름으로 보낸다.
export default function LegacySignupPage() {
  redirect("/signup");
}
