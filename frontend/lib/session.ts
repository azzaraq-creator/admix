export const SESSION_KEY = "adRecommendV2.sessionId";

export function getSessionId(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}

export function setSessionId(id: string): void {
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, id);
}

export function clearSessionId(): void {
  if (typeof window !== "undefined") localStorage.removeItem(SESSION_KEY);
  setChatActiveCookie(false);
}

/**
 * 믹시와 나눈 대화가 있는지 — 서버(홈 화면)가 첫 화면을 그릴 때 읽는다.
 * 대화는 브라우저(localStorage)에만 있어 서버는 모르므로, 새로고침하면 검색 첫 화면이 잠깐 보였다가
 * 대화로 바뀌었다. 이 쿠키가 있으면 서버도 처음부터 "대화를 불러오는 중" 화면을 그린다.
 */
export const CHAT_ACTIVE_COOKIE = "admix-chat-active";

export function setChatActiveCookie(active: boolean): void {
  if (typeof document === "undefined") return;
  document.cookie = active
    ? `${CHAT_ACTIVE_COOKIE}=1; path=/; max-age=31536000; samesite=lax`
    : `${CHAT_ACTIVE_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
