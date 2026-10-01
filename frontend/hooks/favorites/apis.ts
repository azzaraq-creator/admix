import { api } from "@/lib/api";

import {
  buildMediaFilterQuery,
  type MediaCardListResponse,
  type MediaFilterParams,
} from "../media/apis";

/** 관심 매체 — 회원 전용(토큰 필수). */
export const favoritesApi = {
  /** 담은 매체 id(최근에 담은 순) — 하트 켜짐 표시용. */
  ids: () =>
    api
      .get<{ media_ids: string[] }>("/favorites/ids")
      .then((r) => r.data.media_ids),
  /** 관심 매체 페이지 카드 — 매체 찾기 목록과 같은 모양·같은 검색어/필터 조건. */
  list: (filters?: MediaFilterParams) => {
    const qs = buildMediaFilterQuery(filters);
    return api
      .get<MediaCardListResponse>(`/favorites${qs ? `?${qs}` : ""}`)
      .then((r) => r.data);
  },
  add: (mediaId: string) =>
    api.put(`/favorites/${encodeURIComponent(mediaId)}`),
  remove: (mediaId: string) =>
    api.delete(`/favorites/${encodeURIComponent(mediaId)}`),
};
