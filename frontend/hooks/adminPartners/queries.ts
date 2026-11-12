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

/** 매장 콜라보 응답 — 참여 · 미참여 · 무응답 수와 기록(11-12). */
export const useAdminStoreCollabs = (id: string | null) =>
  useQuery({
    queryKey: adminPartnersKeys.collabs(id ?? ""),
    queryFn: () => adminPartnersApi.collabs(id as string),
    enabled: !!id,
    staleTime: 30 * 1000,
  });

export const useAdminPartnersStore = (id: string | null) =>
  useQuery({
    queryKey: adminPartnersKeys.detail(id ?? ""),
    queryFn: () => adminPartnersApi.get(id as string),
    enabled: !!id,
  });
