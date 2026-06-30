import type { MediaFilterParams } from "./apis";

export const mediaKeys = {
  all: ["media"] as const,
  list: () => [...mediaKeys.all, "list"] as const,
  movingList: () => [...mediaKeys.all, "moving", "list"] as const,
  fixedList: (filters?: MediaFilterParams) =>
    [...mediaKeys.all, "fixed", "list", filters ?? {}] as const,
  fixedFilterOptions: () =>
    [...mediaKeys.all, "fixed", "filter-options"] as const,
  detail: (id: string) => [...mediaKeys.all, "detail", id] as const,
};
