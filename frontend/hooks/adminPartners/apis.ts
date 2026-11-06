import { api } from "@/lib/api";
import type { AdminPartnersStore, AdminPartnersStorePayload } from "@/lib/partners";

/** 어드민 콜라보 매장 목록 조건 — status: active(공개)/hidden(숨김), 비우면 전체. */
export interface AdminPartnersListParams {
  keyword?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface AdminPartnersListResponse {
  total: number;
  items: AdminPartnersStore[];
}

export interface PartnersGeocodeResult {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  district: string | null;
}

/** 어드민 "콜라보 매장 관리" — /admin 으로 시작해 어드민 토큰으로 부른다(lib/api). */
export const adminPartnersApi = {
  list: (params?: AdminPartnersListParams) =>
    api
      .get<AdminPartnersListResponse>("/admin/partners/stores", { params })
      .then((r) => r.data),
  get: (id: string) =>
    api
      .get<AdminPartnersStore>(`/admin/partners/stores/${encodeURIComponent(id)}`)
      .then((r) => r.data),
  create: (payload: AdminPartnersStorePayload) =>
    api
      .post<AdminPartnersStore>("/admin/partners/stores", payload)
      .then((r) => r.data),
  update: (id: string, payload: AdminPartnersStorePayload) =>
    api
      .patch<AdminPartnersStore>(
        `/admin/partners/stores/${encodeURIComponent(id)}`,
        payload,
      )
      .then((r) => r.data),
  remove: (id: string) =>
    api.delete(`/admin/partners/stores/${encodeURIComponent(id)}`),
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/admin/partners/stores/images", form)
      .then((r) => r.data.url);
  },
  /** 카카오 지도 SDK로 좌표를 못 찾았을 때 서버(카카오 주소 검색)로 한 번 더. */
  geocode: (address: string) =>
    api
      .get<PartnersGeocodeResult>("/admin/partners/stores/geocode", {
        params: { address },
      })
      .then((r) => r.data),
};
