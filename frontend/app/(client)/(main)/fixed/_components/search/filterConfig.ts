export type ChipDimKey =
  | "category"
  | "saleType"
  | "oohType"
  | "exposureType"
  | "mediaShape";

export type FilterPanelKey = ChipDimKey | "price";

export type FilterOption = { label: string; value: string };

export type FixedFilterState = {
  category: string[];
  saleType: string[];
  oohType: string[];
  exposureType: string[];
  mediaShape: string[];
  priceMin: number | null;
  priceMax: number | null;
};

export const EMPTY_FIXED_FILTER: FixedFilterState = {
  category: [],
  saleType: [],
  oohType: [],
  exposureType: [],
  mediaShape: [],
  priceMin: null,
  priceMax: null,
};

// 코드형 DB 값 → 표시 라벨(Figma 기준). 매핑이 없는 값은 원본 그대로 노출.
// 옵션 목록 자체는 백엔드 filter-options distinct 값에서 가져온다.
const VALUE_LABELS: Partial<Record<ChipDimKey, Record<string, string>>> = {
  oohType: { DOOH: "영상(DOOH)", OOH: "지면(OOH)" },
  exposureType: { INSIDE: "공간형", OUTSIDE: "외부형" },
  mediaShape: {
    HORIZONTAL_SHAPE: "가로형",
    VERTICAL_SHAPE: "세로형",
    CURVED_SHAPE: "커브형",
    DIFFERENT_SHAPE: "변형",
  },
  saleType: {
    PM_INDIVIDUAL: "개별",
    PM_NETWORK: "네트워크",
    PM_PACKAGE: "패키지",
  },
};

export function toOptions(key: ChipDimKey, values: string[]): FilterOption[] {
  const map = VALUE_LABELS[key];
  return values.map((v) => ({ label: map?.[v] ?? v, value: v }));
}

export const FILTER_DIMS: { key: FilterPanelKey; label: string }[] = [
  { key: "category", label: "카테고리" },
  { key: "price", label: "가격 범위" },
  { key: "saleType", label: "매체 판매 유형" },
  { key: "oohType", label: "매체 타입" },
  { key: "exposureType", label: "설치 장소" },
  { key: "mediaShape", label: "매체 형태" },
];

export function dimSelectionCount(
  key: FilterPanelKey,
  f: FixedFilterState,
): number {
  if (key === "price") return f.priceMin != null || f.priceMax != null ? 1 : 0;
  return f[key].length;
}
