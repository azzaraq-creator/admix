"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { authApi, authKeys } from "@/hooks/auth";
import { useClaimGuestProposals } from "@/hooks/proposals";
import { isMemberCategory, type MemberCategory } from "@/lib/memberCategory";

import { COLLAB_SIGNUP_QUERY } from "./CategoryStep";
import type { ContactInfo } from "./InfoStep";

// SNS 가입은 카카오·네이버로 나갔다 돌아오므로, 1단계에서 고른 회원 유형을 잠시 보관한다.
const CATEGORY_KEY = "admix:signup-category";

export function saveSignupCategory(category: MemberCategory) {
  sessionStorage.setItem(CATEGORY_KEY, category);
}

export function loadSignupCategory(): MemberCategory | null {
  const value = sessionStorage.getItem(CATEGORY_KEY);
  return isMemberCategory(value) ? value : null;
}

/**
 * 가입 요청이 성공한 뒤 공통 마무리 — 이메일·SNS 가입이 같이 쓴다.
 * collab — 콜라보에서 시작한 가입이면 가입 완료 화면에도 콜라보 표시(?from=collab)를 이어 준다(콜라보 로고).
 */
export function useFinishSignup(collab = false) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const claimGuest = useClaimGuestProposals();

  // 가입이 끝나면 모든 유형이 가입 완료 화면으로 간다 — 제휴사(콜라보)는 거기서 기본협약 동의로 이어 간다.
  return async (bizFile: File | null, contact: ContactInfo | null = null) => {
    // 게스트 세션 기획안·챗 승계 (best-effort — 실패해도 가입은 유지).
    await claimGuest.mutateAsync().catch(() => {});
    // 사업자등록증은 가입(로그인) 후 올린다. 실패해도 마이페이지에서 다시 올릴 수 있어 막지 않는다.
    if (bizFile)
      await authApi.uploadBusinessRegistration(bizFile).catch(() => {});
    // 광고주 담당자 정보(선택)도 같은 방식 — 실패하면 내 정보에서 다시 적는다.
    if (contact) await authApi.updateProfile(contact).catch(() => {});
    sessionStorage.removeItem(CATEGORY_KEY);
    await queryClient.invalidateQueries({
      queryKey: authKeys.me,
      refetchType: "all",
    });
    router.replace(
      collab ? `/signup/complete?${COLLAB_SIGNUP_QUERY}` : "/signup/complete",
    );
  };
}
