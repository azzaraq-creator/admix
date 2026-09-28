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
 * 조건에 맞는 고정 매체 수만 조회(목록 1건만 받아 total을 쓴다). 매체 찾기 필터 패널에서
 * 아직 적용 전인 선택으로 "결과 보기 N개"를 미리 보여 주는 데 쓴다.
 */
export const useFixedMediaCount = (
  filters: MediaFilterParams,
  enabled = true,
) =>
  useQuery({
    queryKey: mediaKeys.fixedCount(filters),
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

export const useFixedFilterOptions = () =>
  useQuery({
    queryKey: mediaKeys.fixedFilterOptions(),
    queryFn: mediaApi.fixedFilterOptions,
    staleTime: 5 * 60 * 1000,
  });

export const useMediaDetail = (id: string | null) =>
  useQuery({
    queryKey: mediaKeys.detail(id ?? ""),
    queryFn: () => mediaApi.detail(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
