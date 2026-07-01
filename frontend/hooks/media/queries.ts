import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { mediaApi, type MapBounds, type MediaFilterParams } from "./apis";
import { mediaKeys } from "./keys";

const FIXED_PAGE_SIZE = 20;

export const useMediaList = () =>
  useQuery({
    queryKey: mediaKeys.list(),
    queryFn: mediaApi.list,
    staleTime: 60 * 1000,
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

export const useFixedMediaInfinite = (filters?: MediaFilterParams) =>
  useInfiniteQuery({
    queryKey: mediaKeys.fixedList(filters),
    queryFn: ({ pageParam }) =>
      mediaApi.fixedList(FIXED_PAGE_SIZE, pageParam, filters),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: 60 * 1000,
  });

export const useFixedClusters = (
  bounds: MapBounds | null,
  filters?: MediaFilterParams,
) =>
  useQuery({
    queryKey: mediaKeys.fixedClusters(bounds ?? ({} as MapBounds), filters),
    queryFn: () => mediaApi.fixedClusters(bounds as MapBounds, filters),
    enabled: !!bounds,
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
