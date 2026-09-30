"use client";

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { LNB_COLLAPSED_COOKIE } from "./lnbCookie";

/**
 * LNB 상태 두 가지를 localStorage에 두고 여러 컴포넌트가 같이 본다.
 * - expanded: 모바일 드로어 열림(모바일 상단바의 메뉴 버튼으로 연다)
 * - collapsed: 데스크톱에서 아이콘만 보이게 접힘(사이드바 가장자리 버튼으로 토글, 새로고침해도 유지)
 *
 * collapsed는 쿠키(LNB_COLLAPSED_COOKIE)에도 같이 적어, 서버가 첫 화면부터 접힌 모양으로 그린다.
 * (localStorage만 쓰면 서버는 늘 "펼침"으로 그리고, 화면이 뜬 뒤 접히며 폭 애니메이션이 돌아
 * 본문(표·지도)이 여러 번 다시 배치되는 버벅임이 생긴다.)
 */
const EXPANDED_KEY = "lnb-expanded";
const COLLAPSED_KEY = "lnb-collapsed";

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const read = (key: string) => localStorage.getItem(key) === "true";
const write = (key: string, value: boolean) => {
  localStorage.setItem(key, String(value));
  listeners.forEach((listener) => listener());
};
const writeCollapsedCookie = (value: boolean) => {
  document.cookie = `${LNB_COLLAPSED_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`;
};
const getServerSnapshot = () => false;

/** 서버가 쿠키에서 읽은 접힘 상태 — 첫 렌더(서버·하이드레이션)에 쓴다. */
const InitialCollapsedContext = createContext(false);

export function LnbProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  // 쿠키가 생기기 전(localStorage에만 저장돼 있던) 사용자도 다음 새로고침부터 맞게 그려지도록 쿠키를 맞춘다.
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null && (stored === "true") !== initialCollapsed) {
      writeCollapsedCookie(stored === "true");
    }
  }, [initialCollapsed]);

  return createElement(
    InitialCollapsedContext.Provider,
    { value: initialCollapsed },
    children,
  );
}

export function useLnbExpanded() {
  return useSyncExternalStore(
    subscribe,
    () => read(EXPANDED_KEY),
    getServerSnapshot,
  );
}

export function setLnbExpanded(value: boolean) {
  write(EXPANDED_KEY, value);
}

export function useLnbCollapsed() {
  const initial = useContext(InitialCollapsedContext);
  return useSyncExternalStore(
    subscribe,
    () => {
      const stored = localStorage.getItem(COLLAPSED_KEY);
      return stored === null ? initial : stored === "true";
    },
    () => initial,
  );
}

export function setLnbCollapsed(value: boolean) {
  writeCollapsedCookie(value);
  write(COLLAPSED_KEY, value);
}
