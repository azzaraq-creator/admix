"use client";

import { useSyncExternalStore } from "react";

let isOpen = false;

const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const getSnapshot = () => isOpen;
const getServerSnapshot = () => false;

export function useLoginModalOpen() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function setLoginModalOpen(value: boolean) {
  isOpen = value;
  listeners.forEach((listener) => listener());
}

export function openLoginModal() {
  setLoginModalOpen(true);
}

/** 다른 화면(회원가입·비밀번호 찾기 등)에서 "로그인"을 누르면 이 주소로 보낸다 — 대시보드에서 로그인 창이 열린다. */
export const LOGIN_HREF = "/?login=1";
