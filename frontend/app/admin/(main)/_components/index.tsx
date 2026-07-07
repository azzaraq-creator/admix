import type { TableColumn } from "@/components/common/Table/CommonTable";

export type Proposal = {
  no: string;
  name: string;
  member: string;
  mediaCount: string;
  totalAmount: string;
  status: string;
  registeredAt: string;
};

export const proposalColumnList: TableColumn<Proposal>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "name", label: "제안명", className: "text-black" },
  { name: "member", label: "회원명", className: "text-black" },
  { name: "mediaCount", label: "매체 수", className: "text-black" },
  { name: "totalAmount", label: "예상 예산", className: "text-black" },
  { name: "status", label: "상태", className: "text-black" },
  { name: "registeredAt", label: "접수일", className: "text-disabled" },
];
