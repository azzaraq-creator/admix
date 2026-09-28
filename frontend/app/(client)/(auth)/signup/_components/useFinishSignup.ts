"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authApi, authKeys } from "@/hooks/auth";
import { useClaimGuestProposals } from "@/hooks/proposals";
import { isMemberCategory, type MemberCategory } from "@/lib/memberCategory";

// SNS 가입은 카카오·네이버로 나갔다 돌아오므로, 1단계에서 고른 회원 유형을 잠시 보관한다.
const CATEGORY_KEY = "admix:signup-category";

export function saveSignupCategory(category: MemberCategory) {
  sessionStorage.setItem(CATEGORY_KEY, category);
}

export function loadSignupCategory(): MemberCategory | null {
  const value = sessionStorage.getItem(CATEGORY_KEY);
  return isMemberCategory(value) ? value : null;
}

/** 가입 요청이 성공한 뒤 공통 마무리 — 이메일·SNS 가입이 같이 쓴다. */
export function useFinishSignup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const claimGuest = useClaimGuestProposals();

  return async (bizFile: File | null) => {
    // 게스트 세션 제안서·챗 승계 (best-effort — 실패해도 가입은 유지).
    await claimGuest.mutateAsync().catch(() => {});
    // 사업자등록증은 가입(로그인) 후 올린다. 실패해도 마이페이지에서 다시 올릴 수 있어 막지 않는다.
    if (bizFile) await authApi.uploadBusinessRegistration(bizFile).catch(() => {});
    sessionStorage.removeItem(CATEGORY_KEY);
    await queryClient.invalidateQueries({ queryKey: authKeys.me, refetchType: "all" });
    router.replace("/signup/complete");
  };
}
