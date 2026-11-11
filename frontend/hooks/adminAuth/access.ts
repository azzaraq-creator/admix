import type { AdminMe } from "./apis";

/** 마스터 계정 — 권한 설정과 상관없이 모든 메뉴를 본다(백엔드 MASTER_ACCOUNT_TYPE 과 같은 값). */
export const ADMIN_MASTER_TYPE = "마스터 계정";

/** 콜라보 어드민 첫 화면. */
export const COLLAB_ADMIN_HOME = "/admin/collab";

export const isCollabAdminPath = (pathname: string | null) =>
  !!pathname &&
  (pathname === COLLAB_ADMIN_HOME ||
    pathname.startsWith(`${COLLAB_ADMIN_HOME}/`));

/**
 * 콜라보 권한만 있는 관리자(마스터가 아니고 권한이 collab 하나뿐) — admix 쪽(대시보드 포함)은 보이지 않고
 * 로그인하면 바로 콜라보 어드민으로 간다(11-10 사용자). 백엔드 deps.is_collab_only 와 같은 규칙.
 */
export const isCollabOnlyAdmin = (
  me: Pick<AdminMe, "account_type" | "permissions"> | null | undefined,
) =>
  !!me &&
  me.account_type !== ADMIN_MASTER_TYPE &&
  me.permissions.includes("collab") &&
  me.permissions.every((key) => key === "collab");

/** 로그인 뒤 처음 갈 곳 — 콜라보 전용이면 콜라보 어드민, 아니면 admix 대시보드. */
export const adminHomeOf = (
  me: Pick<AdminMe, "account_type" | "permissions"> | null | undefined,
) => (isCollabOnlyAdmin(me) ? COLLAB_ADMIN_HOME : "/admin");
