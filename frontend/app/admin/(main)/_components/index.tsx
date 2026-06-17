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

export const proposalColumnList: TableColumn<Proposal>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "name", label: "제안명", className: "text-black" },
  { name: "member", label: "회원명", className: "text-black" },
  { name: "mediaCount", label: "매체 수", className: "text-black" },
  { name: "budget", label: "예상 예산", className: "text-black" },
  { name: "status", label: "상태", className: "text-black" },
  { name: "date", label: "접수일", className: "text-[#737586]" },
];
