import type { MediaFilterParams, MediaListParams } from "./apis";

export const mediaKeys = {
  all: ["media"] as const,
  list: (params?: MediaListParams) =>
    [...mediaKeys.all, "list", params ?? {}] as const,
  movingList: (filters?: MediaFilterParams) =>
    [...mediaKeys.all, "moving", "list", filters ?? {}] as const,
  movingFilterOptions: () =>
    [...mediaKeys.all, "moving", "filter-options"] as const,
  fixedList: (filters?: MediaFilterParams) =>
    [...mediaKeys.all, "fixed", "list", filters ?? {}] as const,
  findCount: (filters?: MediaFilterParams) =>
    [...mediaKeys.all, "find", "count", filters ?? {}] as const,
  fixedClusters: (zoom: number, filters?: MediaFilterParams) =>
    [...mediaKeys.all, "fixed", "clusters", zoom, filters ?? {}] as const,
  fixedPriceHistogram: (filters?: MediaFilterParams) =>
    [...mediaKeys.all, "fixed", "price-histogram", filters ?? {}] as const,
  filterOptions: () => [...mediaKeys.all, "filter-options"] as const,
  detail: (id: string) => [...mediaKeys.all, "detail", id] as const,
  adminFieldOptions: () =>
    [...mediaKeys.all, "admin", "field-options"] as const,
  adminRealtimePopulation: (
    lat: number | null,
    lng: number | null,
    mediaId: string | null,
  ) =>
    [
      ...mediaKeys.all,
      "admin",
      "realtime-population",
      lat,
      lng,
      mediaId,
    ] as const,
  adminDetail: (id: string) =>
    [...mediaKeys.all, "admin", "detail", id] as const,
};
