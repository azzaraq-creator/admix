"use client";

import { useSyncExternalStore } from "react";

import { getUserToken } from "@/lib/userToken";

const noopSubscribe = () => () => {};

/**
 * 지금 로그인 쿠키가 있는지.
 * 서버 렌더·첫 하이드레이션에선 서버가 넘긴 값(initial)을 써서 화면이 어긋나지 않게 하고,
 * 그 뒤로는 렌더할 때마다 실제 쿠키를 다시 읽는다 — 로그아웃으로 쿠키가 지워지면 바로 false.
 * (서버 값만 쓰면 로그아웃 뒤에도 "회원 정보 불러오는 중"이 끝나지 않는다.)
 */
export function useHasUserToken(initial: boolean): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => !!getUserToken(),
    () => initial,
  );
}
