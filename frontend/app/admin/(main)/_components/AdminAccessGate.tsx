"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { LoadingState } from "@/components/common/RouteStates";
import {
  COLLAB_ADMIN_HOME,
  isCollabAdminPath,
  isCollabOnlyAdmin,
  useAdminMe,
} from "@/hooks/adminAuth";

/**
 * 콜라보 권한만 있는 관리자가 admix 쪽 주소(/admin, /admin/media …)로 오면 본문 대신 로딩을 두고 콜라보 어드민으로 보낸다
 * (11-10 사용자: "admix 쪽은 안 보이게"). 로그인 직후에는 로그인 화면이 바로 콜라보로 보내므로, 여기는 주소를 직접 친 경우용.
 * 회원 정보를 받기 전에는 그대로 그린다 — 다른 관리자 화면이 늦어지지 않게. admix 데이터는 백엔드가 403으로 막는다.
 */
export function AdminAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useAdminMe();
  const blocked = isCollabOnlyAdmin(me) && !isCollabAdminPath(pathname);

  useEffect(() => {
    if (blocked) router.replace(COLLAB_ADMIN_HOME);
  }, [blocked, router]);

  return blocked ? <LoadingState /> : children;
}
