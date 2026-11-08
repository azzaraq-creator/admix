"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authKeys } from "@/hooks/auth";
import { onLogoutAnnounced } from "@/lib/authChannel";
import { getUserToken } from "@/lib/userToken";

/** 쿠키를 다시 읽는 간격 — 뒤에 깔린 탭도 곧 따라오게(브라우저가 뒤 탭 타이머를 늦춰도 1초 남짓). */
const CHECK_MS = 1500;

/**
 * 콜라보 화면 로그인 지킴이 — 로그인 쿠키가 사라지면(다른 탭에서 로그아웃 · 세션 만료) 비회원용 콜라보 소개(/partners)로 옮긴다.
 * 다른 탭이 로그아웃하면 알림(lib/authChannel, BroadcastChannel)을 받아 바로 쿠키를 다시 본다 — 뒤에 깔린 탭도 곧장 옮겨 가
 * 돌아왔을 때 이미 소개가 떠 있다. 알림이 없는 경우(세션 만료 · 알림을 못 쓰는 브라우저)를 위해
 * 탭으로 돌아올 때 · 일정 간격으로 쿠키를 다시 보는 방식도 그대로 둔다.
 * 처음부터 비회원이던 화면은 건드리지 않는다(있던 로그인이 없어졌을 때만). 11-08 사용자.
 */
export function PartnersSessionWatch() {
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    let signedIn = !!getUserToken();
    const check = () => {
      const now = !!getUserToken();
      if (signedIn && !now) {
        // 같은 탭 로그아웃(useLogout)과 똑같이 — 회원 정보 · 캐시를 비우고 소개로.
        queryClient.setQueryData(authKeys.me, null);
        queryClient.clear();
        router.replace("/partners");
      }
      signedIn = now;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, CHECK_MS);
    const stopListening = onLogoutAnnounced(check);
    return () => {
      stopListening();
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [queryClient, router]);

  return null;
}
