export const SESSION_KEY = "adRecommendV2.sessionId";

export function getSessionId(): string | null {
  return typeof window !== "undefined"
    ? localStorage.getItem(SESSION_KEY)
    : null;
}
