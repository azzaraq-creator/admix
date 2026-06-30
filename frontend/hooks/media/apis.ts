import { api } from "@/lib/api";

export interface MediaRow {
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
}

export interface MediaListResponse {
  total: number;
  items: MediaRow[];
}

export interface MediaCardRow {
  id: string;
  name: string;
  minAdvertisementFeeKrw: number | null;
  thumbnailUrl: string | null;
  badge: "popular" | "new" | null;
}

export interface MediaCardListResponse {
  total: number;
  items: MediaCardRow[];
}

export interface MediaFeature {
  label: string;
  value: string;
}

export interface MediaPlanRow {
  planNo: number;
  title: string;
  subtitle: string | null;
}

export interface MediaAgeRatio {
  label: string;
  value: number;
  bound: "under" | "over" | null;
}

export interface MediaPopulation {
  sangwonName: string;
  monthlyFootTraffic: number;
  malePct: number;
  femalePct: number;
  ageRatios: MediaAgeRatio[];
}

export interface MediaDetail {
  id: string;
  name: string;
  badge: "popular" | "new" | null;
  minAdvertisementFeeKrw: number | null;
  maxAdvertisementFeeKrw: number | null;
  description: string | null;
  address: string | null;
  thumbnailUrl: string | null;
  imageUrls: string[];
  sizeText: string | null;
  features: MediaFeature[];
  plans: MediaPlanRow[];
  population: MediaPopulation | null;
}

export interface MediaFilterParams {
  category?: string[];
  oohType?: string[];
  exposureType?: string[];
  mediaShape?: string[];
  productMasterType?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
}

export interface MediaFilterOptions {
  categories: string[];
  ooh_types: string[];
  exposure_types: string[];
  media_shapes: string[];
  product_master_types: string[];
  price_min: number | null;
  price_max: number | null;
  price_histogram: number[];
}

function buildFixedQuery(
  limit: number,
  offset: number,
  f?: MediaFilterParams,
): string {
  const q = new URLSearchParams();
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  f?.category?.forEach((v) => q.append("category", v));
  f?.oohType?.forEach((v) => q.append("ooh_type", v));
  f?.exposureType?.forEach((v) => q.append("exposure_type", v));
  f?.mediaShape?.forEach((v) => q.append("media_shape", v));
  f?.productMasterType?.forEach((v) => q.append("product_master_type", v));
  if (f?.priceMin != null) q.set("price_min", String(f.priceMin));
  if (f?.priceMax != null) q.set("price_max", String(f.priceMax));
  return q.toString();
}

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/media").then((r) => r.data),
  movingList: () =>
    api.get<MediaCardListResponse>("/media/moving").then((r) => r.data),
  fixedList: (limit: number, offset: number, filters?: MediaFilterParams) =>
    api
      .get<MediaCardListResponse>(
        `/media/fixed?${buildFixedQuery(limit, offset, filters)}`,
      )
      .then((r) => r.data),
  fixedFilterOptions: () =>
    api
      .get<MediaFilterOptions>("/media/fixed/filter-options")
      .then((r) => r.data),
  detail: (id: string) =>
    api.get<MediaDetail>(`/media/${id}`).then((r) => r.data),
};
