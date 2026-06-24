import { useMutation, useQueryClient } from "@tanstack/react-query";

import { proposalsClientApi } from "./apis";
import { proposalsKeys } from "./keys";

export const useCreateProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => proposalsClientApi.create(title),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
    },
  });
};

export const useAddProposalItems = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaIds }: { id: string; mediaIds: string[] }) =>
      proposalsClientApi.addItems(id, mediaIds),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useReorderProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaIds }: { id: string; mediaIds: string[] }) =>
      proposalsClientApi.reorder(id, mediaIds),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useRenameProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      proposalsClientApi.rename(id, title),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useDeleteProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
    },
  });
};

export const useSubmitProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.submit(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};
