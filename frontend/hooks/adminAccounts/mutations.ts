import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  adminAccountsApi,
  type AdminAccountCreatePayload,
  type AdminAccountUpdatePayload,
} from "./apis";
import { adminAccountsKeys } from "./keys";

export const useCreateAdminAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminAccountCreatePayload) =>
      adminAccountsApi.create(payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminAccountsKeys.list() }),
  });
};

export const useUpdateAdminAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: AdminAccountUpdatePayload;
    }) => adminAccountsApi.update(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adminAccountsKeys.list() });
      qc.invalidateQueries({ queryKey: adminAccountsKeys.detail(vars.id) });
    },
  });
};

export const useDeleteAdminAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminAccountsApi.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: adminAccountsKeys.list() }),
  });
};
