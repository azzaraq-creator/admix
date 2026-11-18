import { redirect } from "next/navigation";

/**
 * 제휴사(콜라보) 가입·협약 소개 — 지금은 숨겨 둔다(2026-11-18 사용자: "이 페이지 없애지 말고, 일단 숨겨줘").
 * 화면(_components/PartnerJoin)은 그대로 두고, 이 주소로 오면 콜라보 첫 화면으로 보낸다.
 * 다시 열려면 아래를 `return <PartnerJoin />;`(+ metadata "가입·협약 | admix 콜라보")로 되돌리면 된다.
 */
export default function PartnerJoinPage() {
  redirect("/partners");
}
