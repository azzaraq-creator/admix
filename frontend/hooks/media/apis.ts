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
}

export interface MovingMediaListResponse {
  total: number;
  items: MovingMediaRow[];
}

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/media").then((r) => r.data),
  movingList: () =>
    api.get<MovingMediaListResponse>("/media/moving").then((r) => r.data),
};
