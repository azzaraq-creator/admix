import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import {
  adminMediaApi,
  mediaApi,
  type MediaFilterParams,
  type MediaListParams,
} from "./apis";
import { mediaKeys } from "./keys";

const FIXED_PAGE_SIZE = 20;

export const useMediaList = (params?: MediaListParams) =>
  useQuery({
    queryKey: mediaKeys.list(params),
    queryFn: () => mediaApi.list(params),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminMediaDetail = (id: string | null) =>
  useQuery({
    queryKey: mediaKeys.adminDetail(id ?? ""),
    queryFn: () => adminMediaApi.get(id as string),
    enabled: !!id,
  });

export const useMovingMediaList = (filters?: MediaFilterParams) =>
  useQuery({
    queryKey: mediaKeys.movingList(filters),
    queryFn: () => mediaApi.movingList(filters),
    staleTime: 60 * 1000,
  });

export const useMovingFilterOptions = () =>
  useQuery({
    queryKey: mediaKeys.movingFilterOptions(),
    queryFn: mediaApi.movingFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

export const useFixedMediaInfinite = (
  filters?: MediaFilterParams,
  enabled = true,
) =>
  useInfiniteQuery({
    queryKey: mediaKeys.fixedList(filters),
    enabled,
    // 조회 범위(지도 영역)가 바뀌어 다시 불러오는 동안 이전 목록을 그대로 둔다.
    // 목록이 스켈레톤으로 바뀌었다 다시 그려지면 같은 매체 카드의 사진도 새로 불러와 버벅인다.
    placeholderData: keepPreviousData,
    queryFn: ({ pageParam }) =>
      mediaApi.fixedList(FIXED_PAGE_SIZE, pageParam, filters),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: 60 * 1000,
  });

/**
 * 조건에 맞는 매체 수만 조회(목록 1건만 받아 total을 쓴다 — 탭이 전체면 고정+이동).
 * 매체 찾기 필터 패널에서 아직 적용 전인 선택으로 "결과 보기 N개"를 미리 보여 주는 데 쓴다.
 */
export const useMediaFindCount = (filters: MediaFilterParams, enabled = true) =>
  useQuery({
    queryKey: mediaKeys.findCount(filters),
    queryFn: async () => (await mediaApi.fixedList(1, 0, filters)).total,
    enabled,
    staleTime: 60 * 1000,
  });

export const useFixedClusters = (
  zoom: number,
  filters?: MediaFilterParams,
  enabled = true,
) =>
  useQuery({
    queryKey: mediaKeys.fixedClusters(zoom, filters),
    enabled,
    queryFn: () => mediaApi.fixedClusters(zoom, filters),
    staleTime: 60 * 1000,
  });

/** 가격 필터 그래프 막대 — 목록과 같은 조건(지도 영역·검색어·가격 외 필터)의 매체로 센다. */
export const useFixedPriceHistogram = (
  filters: MediaFilterParams,
  enabled = true,
) =>
  useQuery({
    queryKey: mediaKeys.fixedPriceHistogram(filters),
    queryFn: () => mediaApi.fixedPriceHistogram(filters),
    enabled,
    staleTime: 60 * 1000,
    // 조건이 바뀌어 다시 세는 동안 이전 막대를 두어 그래프가 깜빡이지 않게 한다.
    placeholderData: keepPreviousData,
  });

/** 고정·이동 매체 전체 기준 필터 옵션 — 매체 찾기·관심 매체가 쓴다. */
export const useMediaFilterOptions = () =>
  useQuery({
    queryKey: mediaKeys.filterOptions(),
    queryFn: mediaApi.filterOptions,
    staleTime: 5 * 60 * 1000,
  });

/** 어드민 매체 폼 선택지(카테고리·등급 산정 방식). 저장하면 새 값이 들어오도록 짧게 캐시한다. */
export const useAdminMediaFieldOptions = () =>
  useQuery({
    queryKey: mediaKeys.adminFieldOptions(),
    queryFn: adminMediaApi.fieldOptions,
    staleTime: 30 * 1000,
  });

/** 어드민 매체 폼 — 지금 좌표로 실시간 인구를 가져올 수 있는지(서울시는 5분마다 갱신). */
export const useAdminRealtimePopulation = (
  lat: number | null,
  lng: number | null,
  mediaId: string | null,
  enabled = true,
) =>
  useQuery({
    queryKey: mediaKeys.adminRealtimePopulation(lat, lng, mediaId),
    queryFn: () => adminMediaApi.realtimePopulation(lat, lng, mediaId),
    enabled,
    staleTime: 60 * 1000,
  });

export const useMediaDetail = (id: string | null) =>
  useQuery({
    queryKey: mediaKeys.detail(id ?? ""),
    queryFn: () => mediaApi.detail(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
