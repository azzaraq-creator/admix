import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type ProposalStatus =
  | "신규"
  | "맞춤제안"
  | "집행 요청"
  | "계약 완료"
  | "취소";

export type Proposal = {
  no: string;
  name: string;
  member: string;
  mediaCount: string;
  totalAmount: string;
  status: ProposalStatus;
  registeredAt: string;
};

const STATUS_CLASS: Record<ProposalStatus, string> = {
  신규: "bg-[#d6f1ff] text-[#0689ff]",
  맞춤제안: "bg-[#fdf6e3] text-[#c99a2e]",
  "집행 요청": "bg-[#e5f6f6] text-[#007571]",
  "계약 완료": "bg-[#f1f5f9] text-[#64748b]",
  취소: "bg-[#fef2f2] text-[#ef4444]",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
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
  { name: "name", label: "제안서 명" },
  { name: "member", label: "이름" },
  { name: "mediaCount", label: "매체 수" },
  { name: "totalAmount", label: "전체 금액 합계" },
  {
    name: "status",
    label: "상태",
    renderer: (item) => <ProposalStatusBadge status={item.status} />,
  },
  { name: "registeredAt", label: "등록일", className: "text-[#737586]" },
];

export const proposalSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 2,
    optionList: [
      { label: "신규", value: "신규" },
      { label: "맞춤제안", value: "맞춤제안" },
      { label: "계약 완료", value: "계약 완료" },
      { label: "취소", value: "취소" },
    ],
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "검색조건을 입력해주세요",
    row: 2,
  },
];

const STATUS_CYCLE: ProposalStatus[] = [
  "취소",
  "신규",
  "신규",
  "맞춤제안",
  "맞춤제안",
  "맞춤제안",
  "집행 요청",
  "집행 요청",
  "계약 완료",
  "계약 완료",
];

export const PROPOSAL_LIST: Proposal[] = Array.from({ length: 100 }, (_, i) => ({
  no: "12345",
  name: "광고 제안서_2026",
  member: "홍길동",
  mediaCount: "12",
  totalAmount: "380,000,000원",
  status: STATUS_CYCLE[i % STATUS_CYCLE.length],
  registeredAt: "2025-01-01",
}));
