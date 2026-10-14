import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";

import {
  adminMediaApi,
  type CrowdBounds,
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

/**
 * 소수 셋째 자리(약 100m)로 맞춘 지도 영역 — 조금 움직일 때마다 다시 묻지 않게.
 * 바깥쪽으로 맞춘다 — 반올림하면 크게 확대했을 때(레벨 1·2, 화면 폭 수백 m) 영역이 화면보다 좁아지거나
 * 한 점으로 줄어 화면에 걸친 장소가 빠졌다.
 */
const roundBounds = (b: CrowdBounds): CrowdBounds => ({
  neLat: Math.ceil(b.neLat * 1000) / 1000,
  swLat: Math.floor(b.swLat * 1000) / 1000,
  neLng: Math.ceil(b.neLng * 1000) / 1000,
  swLng: Math.floor(b.swLng * 1000) / 1000,
});

/**
 * 매체 찾기 지도 "실시간 인구" — 켰을 때만 묻는다. 서버가 아직 불러오는 장소가 있으면(pending)
 * 3초 뒤 다시, 다 받았으면 서울시 갱신 주기(5분)마다 다시 묻는다.
 */
export const useMediaCrowd = (bounds: CrowdBounds | null, enabled: boolean) => {
  const key = bounds ? roundBounds(bounds) : null;
  return useQuery({
    queryKey: mediaKeys.crowd(key),
    queryFn: () => mediaApi.crowd(key as CrowdBounds),
    enabled: enabled && !!key,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.pending ?? 0) > 0 ? 3000 : 5 * 60 * 1000,
  });
};

/**
 * 매체 찾기 지도 "도로 현황"(서울시 실시간 도로 소통 정보) — 켰을 때만 묻는다. 실시간 인구와 같이 불러오는 구간이 있으면
 * 3초 뒤, 다 받았으면 5분마다 다시 묻는다.
 */
export const useMediaTraffic = (
  bounds: CrowdBounds | null,
  enabled: boolean,
) => {
  const key = bounds ? roundBounds(bounds) : null;
  return useQuery({
    queryKey: mediaKeys.traffic(key),
    queryFn: () => mediaApi.traffic(key as CrowdBounds),
    enabled: enabled && !!key,
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
    refetchInterval: (query) =>
      (query.state.data?.pending ?? 0) > 0 ? 3000 : 5 * 60 * 1000,
  });
};

/** 실시간 인구 장소를 눌렀을 때 — 그 범위 안 지하철·버스 한 달 승하차(서울시는 한 달에 한 번 갱신). */
export const useCrowdTransit = (code: string | null) =>
  useQuery({
    queryKey: mediaKeys.crowdTransit(code),
    queryFn: () => mediaApi.crowdTransit(code as string),
    enabled: !!code,
    staleTime: 60 * 60 * 1000,
  });
