export type BizStatus = "미등록" | "검토 대기" | "검토 완료" | "인증 반려";

const BIZ_STATUS_CLASS: Record<BizStatus, string> = {
  미등록: "bg-platinum-100 text-[#64748b]",
  "검토 대기": "bg-[#fdf6e3] text-[#c99a2e]",
  "검토 완료": "bg-primary-50 text-primary-800",
  "인증 반려": "bg-[#fef2f2] text-[#ef4444]",
};

const BIZ_STATUS_LABEL: Record<string, BizStatus> = {
  unregistered: "미등록",
  reviewing: "검토 대기",
  verified: "검토 완료",
  rejected: "인증 반려",
};

export function bizStatusLabel(code: string | null | undefined): BizStatus {
  return BIZ_STATUS_LABEL[code ?? "unregistered"] ?? "미등록";
}

export function BizStatusBadge({ status }: { status: BizStatus }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] ${BIZ_STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}
