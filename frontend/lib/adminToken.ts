export const ADMIN_TOKEN_COOKIE = "admin_token";
export const ADMIN_REFRESH_COOKIE = "admin_refresh_token";
const ADMIN_PERSIST_COOKIE = "admin_persist";

const PERSIST_MAX_AGE = 60 * 60 * 24 * 30; // 30d (자동로그인 — 마지막 활동 기준 슬라이딩)

function writeCookie(name: string, value: string, persist: boolean) {
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; samesite=lax`;
  if (persist) cookie += `; max-age=${PERSIST_MAX_AGE}`;
  document.cookie = cookie;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function setAdminTokens(
  accessToken: string,
  refreshToken: string,
  persist: boolean,
) {
  writeCookie(ADMIN_TOKEN_COOKIE, accessToken, persist);
  writeCookie(ADMIN_REFRESH_COOKIE, refreshToken, persist);
  writeCookie(ADMIN_PERSIST_COOKIE, persist ? "1" : "0", persist);
}

export function clearAdminToken() {
  deleteCookie(ADMIN_TOKEN_COOKIE);
  deleteCookie(ADMIN_REFRESH_COOKIE);
  deleteCookie(ADMIN_PERSIST_COOKIE);
}

export function getAdminToken(): string | null {
  return readCookie(ADMIN_TOKEN_COOKIE);
}

export function getAdminRefreshToken(): string | null {
  return readCookie(ADMIN_REFRESH_COOKIE);
}

export function getAdminPersist(): boolean {
  return readCookie(ADMIN_PERSIST_COOKIE) === "1";
}
