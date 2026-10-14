"use client";

import { useSyncExternalStore } from "react";

/** 마우스처럼 올려 둘 수 있는 입력이 주 입력인지 — 화면 폭이 아니라 기기 기준(태블릿은 폭이 넓어도 false). */
const HOVER_QUERY = "(hover: hover) and (pointer: fine)";

export function useCanHover(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(HOVER_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(HOVER_QUERY).matches,
    () => true,
  );
}
