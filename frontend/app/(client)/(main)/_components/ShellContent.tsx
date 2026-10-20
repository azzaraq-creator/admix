"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";

import { setPendingMenu, usePendingMenu } from "./menuNav";

/**
 * 본문 칸 — 메뉴를 눌러 다른 화면으로 가는 동안(menuNav의 pending)은 지금 화면 대신 로딩 화면을 바로 보여 준다.
 * 지금 화면이 내려가 불러오던 요청·사진도 멈춘다. 주소가 바뀌면(도착·뒤로 가기 등) 가는 중 표시를 지운다.
 */
export function ShellContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pendingHref = usePendingMenu();

  useEffect(() => {
    setPendingMenu(null);
  }, [pathname]);

  return (
    <div data-shell-content className="relative flex min-h-0 flex-1 flex-col">
      {pendingHref && pendingHref !== pathname ? <LoadingState /> : children}
    </div>
  );
}
