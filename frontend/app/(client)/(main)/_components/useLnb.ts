"use client";

import { useSyncExternalStore } from "react";

/**
 * LNB 상태 두 가지를 localStorage에 두고 여러 컴포넌트가 같이 본다.
 * - expanded: 모바일 드로어 열림(모바일 상단바의 메뉴 버튼으로 연다)
 * - collapsed: 데스크톱에서 아이콘만 보이게 접힘(사이드바 가장자리 버튼으로 토글, 새로고침해도 유지)
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
const getServerSnapshot = () => false;

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
  return useSyncExternalStore(
    subscribe,
    () => read(COLLAPSED_KEY),
    getServerSnapshot,
  );
}

export function setLnbCollapsed(value: boolean) {
  write(COLLAPSED_KEY, value);
}
