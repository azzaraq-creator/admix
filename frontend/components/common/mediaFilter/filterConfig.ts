import type { MediaFilterOptions } from "@/hooks/media";

export type ChipDimKey =
  | "category"
  | "saleType"
  | "oohType"
  | "exposureType"
  | "mediaShape";

export type FilterPanelKey = ChipDimKey | "price";

export type FilterOption = { label: string; value: string };

export type PriceMeta = { min: number; max: number; histogram: number[] } | null;

export type MediaFilterState = {
  category: string[];
  saleType: string[];
  oohType: string[];
  exposureType: string[];
  mediaShape: string[];
  priceMin: number | null;
  priceMax: number | null;
};

export const EMPTY_MEDIA_FILTER: MediaFilterState = {
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
  f: MediaFilterState,
): number {
  if (key === "price") return f.priceMin != null || f.priceMax != null ? 1 : 0;
  return f[key].length;
}

// 백엔드 filter-options 응답을 필터 UI가 쓰는 형태로 변환. fixed/moving 공용.
export function buildFilterUi(opts: MediaFilterOptions | undefined): {
  optionsByKey: Record<ChipDimKey, FilterOption[]>;
  price: PriceMeta;
} {
  const optionsByKey: Record<ChipDimKey, FilterOption[]> = {
    category: toOptions("category", opts?.categories ?? []),
    saleType: toOptions("saleType", opts?.product_master_types ?? []),
    oohType: toOptions("oohType", opts?.ooh_types ?? []),
    exposureType: toOptions("exposureType", opts?.exposure_types ?? []),
    mediaShape: toOptions("mediaShape", opts?.media_shapes ?? []),
  };
  const price =
    opts && opts.price_min != null && opts.price_max != null
      ? {
          min: opts.price_min,
          max: opts.price_max,
          histogram: opts.price_histogram,
        }
      : null;
  return { optionsByKey, price };
}

// MediaFilterState → API 필터 파라미터(칩 차원). bbox/pagination 은 호출부에서 병합.
export function toChipFilterParams(f: MediaFilterState): {
  category: string[];
  oohType: string[];
  exposureType: string[];
  mediaShape: string[];
  productMasterType: string[];
  priceMin: number | null;
  priceMax: number | null;
} {
  return {
    category: f.category,
    oohType: f.oohType,
    exposureType: f.exposureType,
    mediaShape: f.mediaShape,
    productMasterType: f.saleType,
    priceMin: f.priceMin,
    priceMax: f.priceMax,
  };
}
