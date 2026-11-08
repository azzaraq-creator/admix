"use client";

import { useEffect, useState } from "react";

import { authApi } from "./apis";

export type SnsProvider = "kakao" | "naver";

const SNS_RETURN_KEY = "admix:sns-return";

/** 소셜 로그인을 시작할 때 남긴 돌아올 주소를 꺼내고 지운다(OAuth 콜백이 한 번만 쓴다). 같은 사이트 경로만 받는다. */
export function takeSnsReturn(): string | null {
  try {
    const value = sessionStorage.getItem(SNS_RETURN_KEY);
    sessionStorage.removeItem(SNS_RETURN_KEY);
    return value?.startsWith("/") && !value.startsWith("//") ? value : null;
  } catch {
    return null;
  }
}

/**
 * 카카오·네이버 로그인 페이지로 보낸다. 이동하는 동안 버튼을 잠그는 pending을 함께 준다.
 *
 * 소셜 페이지에서 브라우저 뒤로가기로 돌아오면 이 페이지가 새로 뜨지 않고 bfcache에서
 * 떠나기 직전 상태(pending=true) 그대로 복원된다. 그래서 pageshow(persisted)에서 풀어 준다.
 */
export function useSnsLogin() {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPending(false);
    };
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  /** returnTo — 로그인을 마친 뒤 돌아올 주소(콜라보 로그인 창은 지금 보던 콜라보 화면). 없으면 콜백이 정한다. */
  const start = async (provider: SnsProvider, returnTo?: string) => {
    setPending(true);
    try {
      sessionStorage.removeItem(SNS_RETURN_KEY);
      if (returnTo) sessionStorage.setItem(SNS_RETURN_KEY, returnTo);
    } catch {
      // 못 남기면 콜백이 기본 자리로 보낼 뿐.
    }
    try {
      window.location.href = await authApi.snsAuthorizeUrl(provider);
    } catch {
      setPending(false);
    }
  };

  return { pending, start };
}
