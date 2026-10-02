"use client";

import { useSyncExternalStore } from "react";

/** sm(640px) 이상 — Tailwind `sm:`와 같은 기준. 서버 렌더에서는 데스크톱으로 본다. */
const DESKTOP_QUERY = "(min-width: 640px)";

export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(DESKTOP_QUERY);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}
