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

export const mediaApi = {
  list: () => api.get<MediaListResponse>("/media").then((r) => r.data),
};
