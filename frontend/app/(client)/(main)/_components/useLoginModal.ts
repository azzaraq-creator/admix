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
  loginNext = null;
  setLoginModalOpen(true);
}

/**
 * 로그인 뒤 갈 주소가 한 회원 유형만 쓰는 곳일 때(광고주 의뢰서) — 다른 유형으로 로그인하면 옮기지 않고 onOther(안내 창)를 부른다.
 * 창 안 "회원가입"은 이 유형을 1단계에서 미리 골라 둔다.
 */
export type LoginNextOnly = { category: string; onOther: () => void };

export type LoginNext = { href: string; only?: LoginNextOnly };

/**
 * 로그인 뒤 갈 주소 — 콜라보 소개 "의뢰서 작성하기"(로그인하면 바로 의뢰서, 11-23 사용자).
 * 창을 그냥 닫으면 지운다(LoginModal). openLoginModal 은 onClick 에 그대로 넘기는 곳이 있어 주소를 받지 않는다.
 */
let loginNext: LoginNext | null = null;

export function openLoginModalTo(next: string, only?: LoginNextOnly) {
  loginNext = next.startsWith("/") ? { href: next, only } : null;
  setLoginModalOpen(true);
}

/**
 * 로그인 뒤 갈 주소로 옮겨 가는 중 — 그 사이 보던 화면이 "회원이 됐다"며 다른 곳으로 보내지 않게(PartnersHome 은 광고주를 대시보드로 보낸다).
 * 그 화면이 내려갈 때 지운다.
 */
let leaving = false;

export function setLoginLeaving(value: boolean) {
  leaving = value;
}

export function isLoginLeaving() {
  return leaving;
}

/** 로그인 뒤 갈 주소를 꺼낸다(꺼내면 지워진다). */
export function takeLoginNext(): LoginNext | null {
  const next = loginNext;
  loginNext = null;
  return next;
}

/** 다른 화면(회원가입·비밀번호 찾기 등)에서 "로그인"을 누르면 이 주소로 보낸다 — 대시보드에서 로그인 창이 열린다. */
export const LOGIN_HREF = "/?login=1";
