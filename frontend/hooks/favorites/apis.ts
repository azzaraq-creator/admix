import { api } from "@/lib/api";

import {
  buildMediaFilterQuery,
  buildPriceHistogramQuery,
  type MediaCardListResponse,
  type MediaFilterParams,
  type PriceHistogramResponse,
} from "../media/apis";

/** 관심 매체 — 회원 전용(토큰 필수). */
export const favoritesApi = {
  /** 담은 매체 id(최근에 담은 순) — 하트 켜짐 표시용. */
  ids: () =>
    api
      .get<{ media_ids: string[] }>("/favorites/ids")
      .then((r) => r.data.media_ids),
  /** 관심 매체 페이지 카드 — 매체 찾기 목록과 같은 모양·같은 검색어/필터 조건. */
  list: (filters?: MediaFilterParams, signal?: AbortSignal) => {
    const qs = buildMediaFilterQuery(filters);
    return api
      .get<MediaCardListResponse>(`/favorites${qs ? `?${qs}` : ""}`, {
        signal,
      })
      .then((r) => r.data);
  },
  /** 가격 필터 그래프 막대 — 내가 담은 매체 중 검색어·가격 외 필터에 맞는 것으로 센다. */
  priceHistogram: (filters?: MediaFilterParams, signal?: AbortSignal) => {
    const qs = buildPriceHistogramQuery(filters);
    return api
      .get<PriceHistogramResponse>(
        `/favorites/price-histogram${qs ? `?${qs}` : ""}`,
        { signal },
      )
      .then((r) => r.data.histogram);
  },
  add: (mediaId: string) =>
    api.put(`/favorites/${encodeURIComponent(mediaId)}`),
  remove: (mediaId: string) =>
    api.delete(`/favorites/${encodeURIComponent(mediaId)}`),
  /** 담은 매체 메모 — 메모가 있는 것만 {매체 id: 메모}(080, 광고주 관심 매장 카드 아래). */
  memos: () =>
    api
      .get<{ memos: Record<string, string> }>("/favorites/memos")
      .then((r) => r.data.memos),
  /** 메모 저장 — 최대 500자(FAVORITE_MEMO_MAX), 비우면 지운다. 담은 매체만(아니면 404). */
  setMemo: (mediaId: string, memo: string) =>
    api
      .put<{ media_id: string; memo: string | null }>(
        `/favorites/${encodeURIComponent(mediaId)}/memo`,
        { memo },
      )
      .then((r) => r.data.memo),
};

/** 관심 목록 메모 최대 글자 수 — 백엔드 favorite_service.MEMO_MAX 와 같다. */
export const FAVORITE_MEMO_MAX = 500;
