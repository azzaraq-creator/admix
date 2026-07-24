import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { adminAccountsApi, type AccountListParams } from "./apis";
import { adminAccountsKeys } from "./keys";

export const useAdminAccounts = (params?: AccountListParams) =>
  useQuery({
    queryKey: adminAccountsKeys.list(params),
    queryFn: () => adminAccountsApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminAccount = (id: string | null) =>
  useQuery({
    queryKey: adminAccountsKeys.detail(id ?? ""),
    queryFn: () => adminAccountsApi.get(id as string),
    enabled: !!id,
  });
