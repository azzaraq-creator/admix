function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** YYYY.MM.DD HH:mm — withSeconds면 초까지(HH:mm:ss). */
export function formatDateTime(
  iso?: string | null,
  { withSeconds = false }: { withSeconds?: boolean } = {},
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const seconds = withSeconds ? `:${pad(d.getSeconds())}` : "";
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}${seconds}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}
