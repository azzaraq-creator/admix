import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  faqsApi,
  type FaqCreatePayload,
  type FaqUpdatePayload,
} from "./apis";
import { faqsKeys } from "./keys";

export const useCreateFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: FaqCreatePayload) => faqsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqsKeys.list() }),
  });
};

export const useUpdateFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FaqUpdatePayload }) =>
      faqsApi.update(id, payload),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: faqsKeys.list() });
      qc.invalidateQueries({ queryKey: faqsKeys.detail(vars.id) });
    },
  });
};

export const useDeleteFaq = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => faqsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqsKeys.list() }),
  });
};
