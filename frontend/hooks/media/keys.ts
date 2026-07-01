import type { MapBounds, MediaFilterParams } from "./apis";

export const mediaKeys = {
  all: ["media"] as const,
  list: () => [...mediaKeys.all, "list"] as const,
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
};
