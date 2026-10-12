import type { TableColumn } from "@/components/common/Table/CommonTable";

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
    return <span className="text-disabled">-</span>;
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
