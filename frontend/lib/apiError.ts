export function extractApiError(
  err: unknown,
  fallback = "요청 처리 중 오류가 발생했습니다.",
): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  return fallback;
}
