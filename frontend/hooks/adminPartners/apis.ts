import { api } from "@/lib/api";
import type {
  AdminPartnersStore,
  AdminPartnersStorePayload,
  AdminStoreCollabs,
} from "@/lib/partners";

/**
 * 어드민 콜라보 매장 목록 조건 — status: active(공개)/hidden(비공개),
 * linked: yes(제휴사와 연결됨)/no(아직 연결 전), 비우면 전체.
 * keyword 는 매장명 · 주소 · 매장 ID · 회원 고유번호 · 아이디로 찾는다.
 */
export interface AdminPartnersListParams {
  keyword?: string;
  status?: string;
  linked?: string;
  /** 매장 유형 id — 비우면 전체. */
  store_type?: number;
  /** 콜라보 등급 S · A · B · C, "none" 이면 미정 — 비우면 전체. */
  grade?: string;
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

/** 콜라보 어드민 "매장" — /admin 으로 시작해 어드민 토큰으로 부른다(lib/api). 권한 "collab". */
export const adminPartnersApi = {
  list: (params?: AdminPartnersListParams) =>
    api
      .get<AdminPartnersListResponse>("/admin/partners/stores", { params })
      .then((r) => r.data),
  get: (id: string) =>
    api
      .get<AdminPartnersStore>(
        `/admin/partners/stores/${encodeURIComponent(id)}`,
      )
      .then((r) => r.data),
  /** 매장 상세 "콜라보 참여" — 참여 · 미참여 · 무응답 수와 콜라보별 기록(11-12). */
  collabs: (id: string) =>
    api
      .get<AdminStoreCollabs>(
        `/admin/partners/stores/${encodeURIComponent(id)}/collabs`,
      )
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
