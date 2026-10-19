"use client";

import { useEffect, useRef } from "react";

import { registerBackClose } from "@/lib/backClose";

/**
 * 뒤로가기 버튼이 있는 기기(안드로이드)만. 기록을 하나 더 쌓았다 되돌리는 방식이라 "앞으로 가기" 자리에
 * 같은 화면이 남는데, 아이폰·아이패드는 오른쪽 끝에서 쓸면 그게 미리 보이고 뒤로가기 버튼도 없어 끈다.
 * PC 브라우저의 뒤로가기도 그대로 페이지를 옮긴다.
 */
export function hasBackButton() {
  return /Android/i.test(navigator.userAgent);
}

/** 열려 있는 동안 휴대폰 뒤로가기를 누르면 페이지 이동 대신 close를 부른다. */
export function useCloseOnBack(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open || !hasBackButton()) return;
    return registerBackClose(() => closeRef.current());
  }, [open]);
}
