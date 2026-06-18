import type {
  SearchOption,
  TableColumn,
} from "@/components/common/Table/CommonTable";

export type Media = {
  no: string;
  mediaType: "고정" | "이동";
  name: string;
  region: string;
  category: string;
  product: string;
  adCost: string;
  saleType: string;
  updatedAt: string;
  createdAt: string;
};

function RegionCell({ region }: { region: string }) {
  if (region === "-") {
    return <span className="text-[#737586]">-</span>;
  }
  return <span className="block max-w-[180px] truncate">{region}</span>;
}

export const mediaColumnList: TableColumn<Media>[] = [
  { name: "no", label: "No" },
  { name: "mediaType", label: "매체 유형" },
  { name: "name", label: "매체명" },
  {
    name: "region",
    label: "지역",
    renderer: (item) => <RegionCell region={item.region} />,
  },
  { name: "category", label: "카테고리" },
  { name: "product", label: "상품 표시" },
  { name: "adCost", label: "광고비" },
  { name: "saleType", label: "판매유형" },
  { name: "updatedAt", label: "업데이트" },
  { name: "createdAt", label: "등록일" },
];

export const mediaSearchOptionList: SearchOption[] = [
  { type: "dateRange", name: "period", label: "기간", row: 1 },
  {
    type: "select",
    name: "type",
    label: "유형",
    row: 2,
    optionList: [
      { label: "고정", value: "고정" },
      { label: "이동", value: "이동" },
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
