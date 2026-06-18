import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type FaqType = "이용 안내" | "매체검색&제안서";

export type Faq = {
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
  { name: "no", label: "No", className: "text-[#737586]" },
  { name: "type", label: "유형" },
  { name: "title", label: "제목" },
  { name: "author", label: "작성자" },
  { name: "createdAt", label: "작성일", className: "text-[#737586]" },
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

const ITEMS: { type: FaqType; title: string }[] = [
  { type: "이용 안내", title: "ADMIX는 어떤 서비스인가요?" },
  { type: "매체검색&제안서", title: "제안서 작성은 어떻게 하나요?" },
  { type: "매체검색&제안서", title: "매체 검색은 어떻게 하나요?" },
];
const DATES = [
  "2025-01-01", "2025-12-15", "2024-11-20", "2025-05-30", "2025-08-10",
  "2024-09-05", "2025-02-14", "2025-07-01", "2024-10-22", "2025-04-18",
];

export const FAQ_LIST: Faq[] = Array.from({ length: 100 }, (_, i) => {
  const item = ITEMS[i % 10 < 5 ? 0 : (i % 10 < 8 ? 1 : 2)];
  return {
    no: String(12345 + i),
    type: item.type,
    title: item.title,
    author: "홍길동",
    createdAt: DATES[i % DATES.length],
  };
});
