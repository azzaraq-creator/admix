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
 * 가입을 마치면 완료 화면 대신 갈 주소(?next= — 콜라보 소개 "의뢰서 작성하기"로 연 로그인 창의 회원가입은 의뢰서, 11-23 사용자).
 * 소셜 가입은 카카오 · 네이버에 다녀오므로 유형처럼 잠시 보관한다. 지금 쓰는 곳은 광고주 의뢰서뿐이라 광고주로 가입했을 때만 따른다.
 * 콜라보 화면 주소만 받는다(바깥 주소로 보내지 않게). 없으면 지운다 — 예전에 남은 주소를 따르지 않게.
 */
const NEXT_KEY = "admix:signup-next";

export function signupNextOf(value: string | null): string | null {
  return value?.startsWith("/partners/") ? value : null;
}

export function saveSignupNext(value: string | null) {
  try {
    const next = signupNextOf(value);
    if (next) sessionStorage.setItem(NEXT_KEY, next);
    else sessionStorage.removeItem(NEXT_KEY);
  } catch {
    // 못 남기면 가입 완료 화면으로 갈 뿐.
  }
}

function takeSignupNext(): string | null {
  try {
    const next = signupNextOf(sessionStorage.getItem(NEXT_KEY));
    sessionStorage.removeItem(NEXT_KEY);
    return next;
  } catch {
    return null;
  }
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
    const next = takeSignupNext();
    await queryClient.invalidateQueries({
      queryKey: authKeys.me,
      refetchType: "all",
    });
    const me = queryClient.getQueryData<{ member_category?: string }>(
      authKeys.me,
    );
    if (next && me?.member_category === "advertiser") {
      router.replace(next);
      return;
    }
    router.replace(
      collab ? `/signup/complete?${COLLAB_SIGNUP_QUERY}` : "/signup/complete",
    );
  };
}
