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

export interface MovingMediaRow {
  id: string;
  name: string;
  minAdvertisementFeeKrw: number | null;
  thumbnailUrl: string | null;
  badge: "popular" | "new" | null;
}

export interface MovingMediaListResponse {
  total: number;
  items: MovingMediaRow[];
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

export interface MediaDetail {
  id: string;
  name: string;
  badge: "popular" | "new" | null;
  minAdvertisementFeeKrw: number | null;
  maxAdvertisementFeeKrw: number | null;
  description: string | null;
  thumbnailUrl: string | null;
  imageUrls: string[];
  sizeText: string | null;
  features: MediaFeature[];
  plans: MediaPlanRow[];
}

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/media").then((r) => r.data),
  movingList: () =>
    api.get<MovingMediaListResponse>("/media/moving").then((r) => r.data),
  detail: (id: string) =>
    api.get<MediaDetail>(`/media/${id}`).then((r) => r.data),
};
