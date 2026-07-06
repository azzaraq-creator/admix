import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type InquiryStatus = "답변 대기" | "답변 완료";

export type Inquiry = {
  id: string;
  no: string;
  name: string;
  title: string;
  content: string;
  status: InquiryStatus;
  submittedAt: string;
};

const STATUS_CLASS: Record<InquiryStatus, string> = {
  "답변 대기": "bg-[#fdf6e3] text-[#c99a2e]",
  "답변 완료": "bg-primary-50 text-primary-800",
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
  { name: "no", label: "No", className: "text-disabled" },
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
  { name: "submittedAt", label: "제출일", className: "text-disabled" },
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

