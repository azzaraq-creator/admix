import type { TableColumn } from "@/components/common/Table/CommonTable";

export type ProposalStatus = "신규" | "취소" | "회신" | "완료";

export type Proposal = {
  no: string;
  name: string;
  member: string;
  mediaCount: number;
  budget: string;
  status: ProposalStatus;
  date: string;
};

const STATUS_CLASS: Record<ProposalStatus, string> = {
  신규: "bg-[#e5f6f6] text-[#007571]",
  취소: "bg-[#fef2f2] text-[#ef4444]",
  회신: "bg-[#eef2ff] text-[#4f6bed]",
  완료: "bg-[#f1f5f9] text-[#64748b]",
};

function StatusBadge({ status }: { status: ProposalStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] ${STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}

export const proposalColumnList: TableColumn<Proposal>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "name", label: "제안명", className: "text-black" },
  { name: "member", label: "회원명", className: "text-black" },
  { name: "mediaCount", label: "매체 수", className: "text-black" },
  { name: "budget", label: "예상 예산", className: "text-black" },
  {
    name: "status",
    label: "상태",
    renderer: (item) => <StatusBadge status={item.status} />,
  },
  { name: "date", label: "접수일", className: "text-[#737586]" },
];
