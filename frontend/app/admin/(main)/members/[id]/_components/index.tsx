import type { TableColumn } from "@/components/common/Table/CommonTable";

/* ---------- 제재 이력 ---------- */

export type Sanction = {
  id: string;
  no: string;
  reason: string;
  detail: string;
  sanctionedAt: string;
  endAt: string;
};

export const sanctionColumnList: TableColumn<Sanction>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "reason", label: "제재 이력" },
  { name: "sanctionedAt", label: "제재 일자" },
  { name: "endAt", label: "제재 종료" },
];
