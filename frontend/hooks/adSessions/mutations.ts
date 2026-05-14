import { useMutation, useQueryClient } from "@tanstack/react-query";

import { adSessionsApi } from "./apis";
import { adSessionsKeys } from "./keys";

export const useCreateAdSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title?: string | null) => adSessionsApi.create(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: adSessionsKeys.list() }),
  });
};

export const useDeleteAdSession = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adSessionsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: adSessionsKeys.list() }),
  });
};

export const usePatchAdSessionTitle = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      adSessionsApi.patch(id, title),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adSessionsKeys.list() });
      qc.invalidateQueries({ queryKey: adSessionsKeys.detail(vars.id) });
    },
  });
};
