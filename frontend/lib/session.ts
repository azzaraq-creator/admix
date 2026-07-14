export const SESSION_KEY = "adRecommendV2.sessionId";

export function getSessionId(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}

export function setSessionId(id: string): void {
  if (typeof window !== "undefined") localStorage.setItem(SESSION_KEY, id);
}
