export function formatFee(krw: number | null): string {
  if (krw == null) return "최소집행금액 협의";
  return `최소집행금액 ${Math.round(krw / 10000).toLocaleString()}만원`;
}

export function formatV2Price(raw?: string): string {
  if (!raw) return "최소집행금액 협의";
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;
  const n = Number(digits);
  if (!Number.isFinite(n)) return raw;
  return `최소집행금액 ${Math.round(n / 10000).toLocaleString()}만원`;
}
