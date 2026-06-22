export const USER_TOKEN_COOKIE = "user_token";

const PERSIST_MAX_AGE = 60 * 60 * 24 * 7; // 7d

export function setUserToken(token: string, persist: boolean) {
  let cookie = `${USER_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; samesite=lax`;
  if (persist) cookie += `; max-age=${PERSIST_MAX_AGE}`;
  document.cookie = cookie;
}

export function clearUserToken() {
  document.cookie = `${USER_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function getUserToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )user_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
