"use client";

import { useSyncExternalStore } from "react";

const EVENT = "admix:stored-flag";

/**
 * 이 브라우저(localStorage)에 기억해 두는 켜고 끄기 — 목록 간략히 보기 등.
 * 아직 고른 적 없으면(또는 서버 렌더·저장이 막힌 브라우저) null — 화면마다 기본값을 정한다.
 */
export function useStoredFlag(key: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    () => {
      try {
        const v = window.localStorage.getItem(key);
        return v == null ? null : v === "1";
      } catch {
        return null;
      }
    },
    () => null,
  );
}

export function setStoredFlag(key: string, on: boolean) {
  try {
    window.localStorage.setItem(key, on ? "1" : "0");
  } catch {
    // 저장이 막힌 브라우저 — 기억은 못 한다.
  }
  window.dispatchEvent(new Event(EVENT));
}
