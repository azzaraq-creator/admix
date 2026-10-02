import type { MediaFilterParams } from "../media/apis";

export const favoritesKeys = {
  all: ["favorites"] as const,
  ids: () => [...favoritesKeys.all, "ids"] as const,
  list: (filters?: MediaFilterParams) =>
    [...favoritesKeys.all, "list", filters ?? {}] as const,
  priceHistogram: (filters?: MediaFilterParams) =>
    [...favoritesKeys.all, "price-histogram", filters ?? {}] as const,
};
