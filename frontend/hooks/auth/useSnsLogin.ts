"use client";

import { useEffect, useState } from "react";

import { authApi } from "./apis";

export type SnsProvider = "kakao" | "naver";

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

  const start = async (provider: SnsProvider) => {
    setPending(true);
    try {
      window.location.href = await authApi.snsAuthorizeUrl(provider);
    } catch {
      setPending(false);
    }
  };

  return { pending, start };
}
