import type { TableColumn } from "@/components/common/Table/CommonTable";

/* ---------- 제안 이력 ---------- */

export type ProposalStatus = "취소" | "신규" | "맞춤제안" | "계약 완료";

export type ProposalHistory = {
  no: string;
  proposalName: string;
  name: string;
  totalAmount: string;
  status: ProposalStatus;
  registeredAt: string;
};

const PROPOSAL_STATUS_CLASS: Record<ProposalStatus, string> = {
  취소: "bg-[#fef2f2] text-[#ef4444]",
  신규: "bg-[#eef2ff] text-[#4f6bed]",
  맞춤제안: "bg-[#fdf6e3] text-[#c99a2e]",
  "계약 완료": "bg-[#e5f6f6] text-[#007571]",
};

function StatusBadge({ className, label }: { className: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] ${className}`}
    >
      {label}
    </span>
  );
}

export const proposalColumnList: TableColumn<ProposalHistory>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "proposalName", label: "제안서 명" },
  { name: "name", label: "이름" },
  { name: "totalAmount", label: "전체 금액 합계" },
  {
    name: "status",
    label: "상태",
    renderer: (item) => (
      <StatusBadge
        className={PROPOSAL_STATUS_CLASS[item.status]}
        label={item.status}
      />
    ),
  },
  { name: "registeredAt", label: "등록일", className: "text-[#737586]" },
];

const PROPOSAL_STATUS_CYCLE: ProposalStatus[] = [
  "취소",
  "신규",
  "신규",
  "맞춤제안",
  "맞춤제안",
  "맞춤제안",
  "계약 완료",
  "계약 완료",
  "계약 완료",
  "계약 완료",
];

export const PROPOSAL_HISTORY: ProposalHistory[] = Array.from(
  { length: 100 },
  (_, i) => ({
    no: "12345",
    proposalName: "광고 제안서_2026",
    name: "홍길동",
    totalAmount: "380,000,000원",
    status: PROPOSAL_STATUS_CYCLE[i % PROPOSAL_STATUS_CYCLE.length],
    registeredAt: "2025-01-01",
  }),
);

/* ---------- 문의 이력 ---------- */

export type InquiryStatus = "답변 대기" | "답변 완료";

export type InquiryHistory = {
  no: string;
  name: string;
  title: string;
  content: string;
  status: InquiryStatus;
  submittedAt: string;
};

const INQUIRY_STATUS_CLASS: Record<InquiryStatus, string> = {
  "답변 대기": "bg-[#fdf6e3] text-[#c99a2e]",
  "답변 완료": "bg-[#e5f6f6] text-[#007571]",
};

export const inquiryColumnList: TableColumn<InquiryHistory>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "name", label: "이름" },
  { name: "title", label: "제목" },
  {
    name: "content",
    label: "문의 내용",
    renderer: (item) => (
      <span className="block max-w-[360px] truncate">{item.content}</span>
    ),
  },
  {
    name: "status",
    label: "상태",
    renderer: (item) => (
      <StatusBadge
        className={INQUIRY_STATUS_CLASS[item.status]}
        label={item.status}
      />
    ),
  },
  { name: "submittedAt", label: "제출일", className: "text-[#737586]" },
];

export const INQUIRY_HISTORY: InquiryHistory[] = Array.from(
  { length: 100 },
  (_, i) => ({
    no: "12345",
    name: "홍길동",
    title: "광고 매체 관련 문의",
    content:
      "문의 내용 임시 요약본입니다문의 내용 임시 요약본입니다문의 내용의...",
    status: i % 10 < 5 ? "답변 대기" : "답변 완료",
    submittedAt: "2025-01-01",
  }),
);

/* ---------- 제재 이력 ---------- */

export type Sanction = {
  no: string;
  reason: string;
  sanctionedAt: string;
  endAt: string;
};

export const sanctionColumnList: TableColumn<Sanction>[] = [
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "reason", label: "제재 이력" },
  { name: "sanctionedAt", label: "제재 일자" },
  { name: "endAt", label: "제재 종료" },
];

export const SANCTION_HISTORY: Sanction[] = [
  {
    no: "1",
    reason: "서비스 규제 위반",
    sanctionedAt: "2025-06-10",
    endAt: "2025-06-10",
  },
];
