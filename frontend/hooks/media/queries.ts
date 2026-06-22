import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { mediaApi } from "./apis";
import { mediaKeys } from "./keys";

const FIXED_PAGE_SIZE = 20;

export const useMediaList = () =>
  useQuery({
    queryKey: mediaKeys.list(),
    queryFn: mediaApi.list,
    staleTime: 60 * 1000,
  });

export const useMovingMediaList = () =>
  useQuery({
    queryKey: mediaKeys.movingList(),
    queryFn: mediaApi.movingList,
    staleTime: 60 * 1000,
  });

export const useFixedMediaInfinite = () =>
  useInfiniteQuery({
    queryKey: mediaKeys.fixedList(),
    queryFn: ({ pageParam }) => mediaApi.fixedList(FIXED_PAGE_SIZE, pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    staleTime: 60 * 1000,
  });

export const useMediaDetail = (id: string | null) =>
  useQuery({
    queryKey: mediaKeys.detail(id ?? ""),
    queryFn: () => mediaApi.detail(id as string),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
