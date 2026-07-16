import { cn } from "@/lib/utils";

// backend status(raw) → 사용자 노출 라벨/칩 색상. 제안서 리스트·상세 공통.
const STATUS_LABEL: Record<string, string> = {
  new: "작성중",
  custom: "맞춤제안",
  execution_requested: "제출완료",
  contracted: "계약완료",
  cancelled: "취소",
};

const STATUS_CLASS: Record<string, string> = {
  new: "bg-grey-50 text-[#545454]",
  custom: "bg-[#fff3d3] text-[#ff920a]",
  execution_requested: "bg-[#d6f1ff] text-[#0689ff]",
  contracted: "bg-secondary text-primary",
  cancelled: "bg-[#fef2f2] text-[#ef4444]",
};

export function StatusChip({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px]",
        STATUS_CLASS[status] ?? STATUS_CLASS.new,
        className,
      )}
    >
      {STATUS_LABEL[status] ?? STATUS_LABEL.new}
    </span>
  );
}
