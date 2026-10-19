"use client";

import { useEffect, useRef } from "react";

import { registerBackClose } from "@/lib/backClose";

/** 터치 기기(휴대폰·태블릿)만 — PC 브라우저의 뒤로가기는 그대로 페이지를 옮긴다. */
export function isTouchDevice() {
  return !window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** 열려 있는 동안 휴대폰 뒤로가기를 누르면 페이지 이동 대신 close를 부른다. */
export function useCloseOnBack(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open || !isTouchDevice()) return;
    return registerBackClose(() => closeRef.current());
  }, [open]);
}
