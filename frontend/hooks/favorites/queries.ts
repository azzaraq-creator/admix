import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { MediaFilterParams } from "../media/apis";

import { useMe } from "../auth";
import { favoritesApi } from "./apis";
import { favoritesKeys } from "./keys";

/** 담은 매체 id — 로그인한 회원만 조회한다(비회원은 빈 목록). */
export const useFavoriteIds = () => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: favoritesKeys.ids(),
    queryFn: favoritesApi.ids,
    enabled: !!me,
    staleTime: 60 * 1000,
  });
};

/**
 * 관심 매체 페이지 카드 목록 — 검색어·필터를 바꿔 다시 불러오는 동안 이전 목록을 둔다.
 * enabled: 필터 패널의 "결과 N개" 미리 세기처럼 필요할 때만 조회할 때 쓴다.
 */
export const useFavoriteList = (
  filters?: MediaFilterParams,
  enabled = true,
) => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: favoritesKeys.list(filters),
    queryFn: () => favoritesApi.list(filters),
    enabled: !!me && enabled,
    placeholderData: keepPreviousData,
  });
};

/** 관심 매체 가격 필터 그래프 막대 — 담은 매체를 담거나 빼면(favoritesKeys.all 무효화) 다시 센다. */
export const useFavoritePriceHistogram = (
  filters: MediaFilterParams,
  enabled = true,
) => {
  const { data: me } = useMe();
  return useQuery({
    queryKey: favoritesKeys.priceHistogram(filters),
    queryFn: () => favoritesApi.priceHistogram(filters),
    enabled: !!me && enabled,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
};
