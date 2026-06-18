import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type InquiryStatus = "답변 대기" | "답변 완료";

export type Inquiry = {
  no: string;
  name: string;
  title: string;
  content: string;
  status: InquiryStatus;
  submittedAt: string;
};

const STATUS_CLASS: Record<InquiryStatus, string> = {
  "답변 대기": "bg-[#fdf6e3] text-[#c99a2e]",
  "답변 완료": "bg-[#e5f6f6] text-[#007571]",
};

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] ${STATUS_CLASS[status]}`}
    >
      {status}
    </span>
  );
}

export const inquiryColumnList: TableColumn<Inquiry>[] = [
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
    renderer: (item) => <InquiryStatusBadge status={item.status} />,
  },
  { name: "submittedAt", label: "제출일", className: "text-[#737586]" },
];

export const inquirySearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "status",
    label: "상태",
    row: 2,
    optionList: [
      { label: "답변 대기", value: "답변 대기" },
      { label: "답변 완료", value: "답변 완료" },
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

export const INQUIRY_LIST: Inquiry[] = Array.from({ length: 100 }, (_, i) => ({
  no: "12345",
  name: "홍길동",
  title: "광고 매체 관련 문의",
  content:
    "문의 내용 임시 요약본입니다문의 내용 임시 요약본입니다문의 내용의...",
  status: i % 10 < 5 ? "답변 대기" : "답변 완료",
  submittedAt: "2025-01-01",
}));
