export const ADMIN_TOKEN_COOKIE = "admin_token";

const PERSIST_MAX_AGE = 60 * 60 * 24; // 24h

export function setAdminToken(token: string, persist: boolean) {
  let cookie = `${ADMIN_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; samesite=lax`;
  if (persist) cookie += `; max-age=${PERSIST_MAX_AGE}`;
  document.cookie = cookie;
}

export function clearAdminToken() {
  document.cookie = `${ADMIN_TOKEN_COOKIE}=; path=/; max-age=0`;
}

export function getAdminToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )admin_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}
