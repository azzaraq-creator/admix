"use client";

import { useEffect } from "react";

import { reloadForAccount } from "@/hooks/auth";
import { onSwitchAnnounced } from "@/lib/authChannel";

/**
 * 다른 탭에서 슈퍼 계정을 다른 유형 계정으로 바꾸면(087) 이 탭도 새 계정으로 다시 연다.
 * 로그인 쿠키는 탭끼리 같이 쓰므로, 그대로 두면 이 탭은 옛 계정 화면에 새 계정 데이터가 섞여 보인다.
 */
export function AccountSwitchWatch() {
  useEffect(
    () => onSwitchAnnounced(() => reloadForAccount(window.location.pathname)),
    [],
  );
  return null;
}
