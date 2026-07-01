import { cn } from "@/lib/utils";

export function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function InquiryStatusChip({ status }: { status: string }) {
  const answered = status === "answered";
  return (
    <span
      className={cn(
        "shrink-0 rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px]",
        answered ? "bg-secondary text-primary" : "bg-[#fff3d3] text-[#ff920a]",
      )}
    >
      {answered ? "답변 완료" : "답변 대기"}
    </span>
  );
}
