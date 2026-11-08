"use client";

import { usePathname } from "next/navigation";
import {
  useEffect,
  useSyncExternalStore,
  type MouseEvent,
  type ReactNode,
} from "react";

import { LoadingState } from "@/components/common/RouteStates";

/**
 * 콜라보 메뉴(사이드바 · 아래 탭 바 · 더보기)로 화면을 옮기는 동안의 상태 — admix 메뉴(menuNav · ShellContent)와 같은 방식.
 *
 * 다음 화면은 서버 응답이 와야 그려진다(운영 첫 요청 약 2초 · 개발 서버 첫 컴파일 수 초). 그동안 지금 화면이 그대로라
 * 메뉴를 눌러도 안 눌린 것처럼 보였다(11-08 사용자). 그래서 메뉴를 누르면 "어디로 가는 중"을 적어 두고
 * 본문은 곧바로 로딩 화면으로 바꾸며, 메뉴도 바로 그 칸이 켜진다. 주소가 바뀌면(도착 · 뒤로 가기 등) 지운다.
 * (loading.tsx 는 운영에서 미리 받아 둔 화면에만 바로 뜨고, 개발 서버 · 미리 못 받은 화면에선 뜨지 않는다.)
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

const setPending = (href: string | null) => {
  if (pending === href) return;
  pending = href;
  listeners.forEach((listener) => listener());
};

/** 메뉴로 가는 중인 주소(없으면 null). */
export const usePartnersPending = () =>
  useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );

/**
 * 메뉴 링크를 누를 때 — 지금 화면과 다른 곳이면 가는 중으로 적는다.
 * 새 탭 · 새 창으로 여는 클릭(⌘ · Ctrl · Shift · 가운데 버튼)은 이 탭이 옮겨 가지 않으니 적지 않는다.
 */
export function markPartnersPending(
  event: MouseEvent<HTMLElement>,
  href: string,
  pathname: string,
) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return;
  setPending(href === pathname ? null : href);
}

/** 콜라보 본문 — 메뉴로 다른 화면에 가는 동안은 지금 화면 대신 로딩 화면(admix ShellContent와 같다). */
export function PartnersContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pendingHref = usePartnersPending();

  useEffect(() => {
    setPending(null);
  }, [pathname]);

  return pendingHref && pendingHref !== pathname ? <LoadingState /> : children;
}
