import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type FaqType = "이용 안내" | "매체검색&제안서";

export type Faq = {
  id: string;
  no: string;
  type: FaqType;
  title: string;
  author: string;
  createdAt: string;
};

export const FAQ_TYPE_OPTIONS: { label: string; value: FaqType }[] = [
  { label: "이용 안내", value: "이용 안내" },
  { label: "매체검색&제안서", value: "매체검색&제안서" },
];

export const faqColumnList: TableColumn<Faq>[] = [
  { name: "no", label: "No", className: "text-disabled" },
  { name: "type", label: "유형" },
  { name: "title", label: "제목" },
  { name: "author", label: "작성자" },
  { name: "createdAt", label: "작성일", className: "text-disabled" },
];

export const faqSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "type",
    label: "유형",
    row: 2,
    optionList: FAQ_TYPE_OPTIONS,
  },
  {
    type: "text",
    name: "keyword",
    label: "",
    placeholder: "검색조건을 입력해주세요",
    row: 2,
  },
];

