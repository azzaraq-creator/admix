import type { AdminPartnersListParams } from "./apis";

export const adminPartnersKeys = {
  all: ["adminPartners"] as const,
  list: (params?: AdminPartnersListParams) =>
    [...adminPartnersKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...adminPartnersKeys.all, "detail", id] as const,
};
