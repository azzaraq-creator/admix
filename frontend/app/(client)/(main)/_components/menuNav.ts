"use client";

import { usePathname, useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";

import type { MenuItem } from "./Sidebar";

/**
 * 메뉴(사이드 메뉴·모바일 하단 탭 바)로 화면을 옮기는 동안의 상태.
 *
 * 다음 화면은 서버 응답이 와야 그려져서, 느린 연결에선 누른 뒤에도 한참 지금 화면이 남는다. 그래서 메뉴를
 * 누르면 "어디로 가는 중"(pending)을 적어 두고, 본문은 곧바로 로딩 화면으로 바꾼다(ShellContent). 메뉴도
 * 바로 그 칸이 켜진다. 지금 화면이 내려가므로 불러오던 목록 요청도 끊긴다(목록 요청은 signal을 받아 화면이 내려가면 멈춘다).
 * 가는 중인 메뉴를 다시 누르거나 이미 그 화면에 있으면 아무 일도 하지 않는다 — 누를 때마다 다시 요청하지 않게.
 */
let pending: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};

export const setPendingMenu = (href: string | null) => {
  if (pending === href) return;
  pending = href;
  listeners.forEach((listener) => listener());
};

export const usePendingMenu = () =>
  useSyncExternalStore(
    subscribe,
    () => pending,
    () => null,
  );

/** 이 메뉴가 가리키는 화면에 있는지 — 매체 찾기는 고정·이동 어디서든, 나머지는 목록 화면에서만. */
const isOnMenu = (item: MenuItem, pathname: string) =>
  item.key === "fixed"
    ? [item.href, ...(item.alsoActiveOn ?? [])].some((path) =>
        pathname.startsWith(path),
      )
    : pathname === item.href;

/** 메뉴 링크마다 켜짐 여부와 누를 때 할 일을 돌려준다. */
export function useMenuLink() {
  const pathname = usePathname() ?? "";
  const pendingHref = usePendingMenu();
  const router = useRouter();

  return (item: MenuItem) => {
    const active = pendingHref
      ? pendingHref === item.href
      : [item.href, ...(item.alsoActiveOn ?? [])].some((path) =>
          pathname.startsWith(path),
        );
    const onClick = (e: MouseEvent) => {
      // 이미 그쪽으로 가는 중 — 다시 요청하지 않는다.
      if (pendingHref === item.href) return e.preventDefault();
      if (isOnMenu(item, pathname)) {
        e.preventDefault();
        // 다른 화면으로 가던 중에 지금 화면 메뉴를 누르면 그 이동을 접고 지금 화면에 남는다
        // (지금 주소로 다시 이동해 앞선 이동을 덮는다).
        if (pendingHref) {
          setPendingMenu(null);
          router.replace(window.location.pathname + window.location.search);
        }
        return;
      }
      setPendingMenu(item.href);
    };
    return { active, onClick };
  };
}
