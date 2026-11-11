import { redirect } from "next/navigation";

/**
 * 예전 매장 등록(가입 03) 주소 — 매장 등록은 담당자가 어드민에서 한다(2026-11-09, 069).
 * 옛 링크로 오면 대시보드로(협약 · 매장 연결 안내는 대시보드가 한다).
 */
export default function PartnerStoreJoinPage() {
  redirect("/partners/dashboard");
}
