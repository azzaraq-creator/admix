import type { MapBounds, MediaFilterParams, MediaListParams } from "./apis";

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
  fixedClusters: (bounds: MapBounds, filters?: MediaFilterParams) =>
    [...mediaKeys.all, "fixed", "clusters", bounds, filters ?? {}] as const,
  fixedFilterOptions: () =>
    [...mediaKeys.all, "fixed", "filter-options"] as const,
  detail: (id: string) => [...mediaKeys.all, "detail", id] as const,
  adminDetail: (id: string) => [...mediaKeys.all, "admin", "detail", id] as const,
};
