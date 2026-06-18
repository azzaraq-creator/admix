import { MapPinIcon } from "@/components/icons";
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
  return (
    <span className="inline-flex items-center justify-center gap-[4px]">
      <MapPinIcon className="size-[16px] shrink-0 text-primary" />
      <span className="max-w-[180px] truncate">{region}</span>
    </span>
  );
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
  { type: "dateRange", name: "period", label: "기간" },
  {
    type: "select",
    name: "type",
    label: "유형",
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
  },
];

const FIXED_TEMPLATE: Omit<Media, "no"> = {
  mediaType: "고정",
  name: "신사 BK빌딩",
  region: "LOC-01 강남역·테헤란로 / 강남대로 사거리",
  category: "전광판/빌보드",
  product: "영상(15초)",
  adCost: "10,000,000",
  saleType: "단품",
  updatedAt: "2025-01-01",
  createdAt: "2025-01-01",
};

const MOVING_TEMPLATE: Omit<Media, "no"> = {
  mediaType: "이동",
  name: "G버스 내부 유리창 프로모션",
  region: "-",
  category: "버스",
  product: "프로모션",
  adCost: "80,000",
  saleType: "단품",
  updatedAt: "2025-01-01",
  createdAt: "2025-01-01",
};

export const MEDIA_LIST: Media[] = Array.from({ length: 100 }, (_, i) => {
  const template = i % 10 < 5 ? FIXED_TEMPLATE : MOVING_TEMPLATE;
  return { no: String(12345 + i), ...template };
});
