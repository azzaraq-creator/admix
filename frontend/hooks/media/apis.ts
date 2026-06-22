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

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/media").then((r) => r.data),
  movingList: () =>
    api.get<MediaCardListResponse>("/media/moving").then((r) => r.data),
  fixedList: (limit: number, offset: number) =>
    api
      .get<MediaCardListResponse>("/media/fixed", { params: { limit, offset } })
      .then((r) => r.data),
  detail: (id: string) =>
    api.get<MediaDetail>(`/media/${id}`).then((r) => r.data),
};
