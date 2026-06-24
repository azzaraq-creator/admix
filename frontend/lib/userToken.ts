export const USER_TOKEN_COOKIE = "user_token";
export const REFRESH_TOKEN_COOKIE = "user_refresh_token";
const PERSIST_COOKIE = "user_persist";

const PERSIST_MAX_AGE = 60 * 60 * 24 * 30; // 30d

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

export function setTokens(
  accessToken: string,
  refreshToken: string,
  persist: boolean,
) {
  writeCookie(USER_TOKEN_COOKIE, accessToken, persist);
  writeCookie(REFRESH_TOKEN_COOKIE, refreshToken, persist);
  writeCookie(PERSIST_COOKIE, persist ? "1" : "0", persist);
}

export function clearUserToken() {
  deleteCookie(USER_TOKEN_COOKIE);
  deleteCookie(REFRESH_TOKEN_COOKIE);
  deleteCookie(PERSIST_COOKIE);
}

export function getUserToken(): string | null {
  return readCookie(USER_TOKEN_COOKIE);
}

export function getRefreshToken(): string | null {
  return readCookie(REFRESH_TOKEN_COOKIE);
}

export function getPersist(): boolean {
  return readCookie(PERSIST_COOKIE) === "1";
}
