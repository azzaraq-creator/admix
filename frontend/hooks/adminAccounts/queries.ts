import { useQuery } from "@tanstack/react-query";

import { adminAccountsApi } from "./apis";
import { adminAccountsKeys } from "./keys";

export const useAdminAccounts = () =>
  useQuery({
    queryKey: adminAccountsKeys.list(),
    queryFn: adminAccountsApi.list,
    staleTime: 30 * 1000,
  });

export const useAdminAccount = (id: string | null) =>
  useQuery({
    queryKey: adminAccountsKeys.detail(id ?? ""),
    queryFn: () => adminAccountsApi.get(id as string),
    enabled: !!id,
  });
