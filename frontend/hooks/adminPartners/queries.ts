import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { adminPartnersApi, type AdminPartnersListParams } from "./apis";
import { adminPartnersKeys } from "./keys";

export const useAdminPartnersStores = (params?: AdminPartnersListParams) =>
  useQuery({
    queryKey: adminPartnersKeys.list(params),
    queryFn: () => adminPartnersApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminPartnersStore = (id: string | null) =>
  useQuery({
    queryKey: adminPartnersKeys.detail(id ?? ""),
    queryFn: () => adminPartnersApi.get(id as string),
    enabled: !!id,
  });
