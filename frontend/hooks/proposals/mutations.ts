import { useMutation, useQueryClient } from "@tanstack/react-query";

import { getSessionId } from "@/lib/session";

import { proposalsApi, proposalsClientApi } from "./apis";
import { proposalsKeys } from "./keys";

export const useClaimGuestProposals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => {
      const sid = getSessionId();
      if (!sid) return Promise.resolve({ claimed: 0 });
      return proposalsClientApi.claim(sid);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
    },
  });
};

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
    mutationFn: ({
      id,
      mediaIds,
      plans,
    }: {
      id: string;
      mediaIds: string[];
      plans?: Record<string, number>;
    }) => proposalsClientApi.addItems(id, mediaIds, plans),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useRemoveProposalItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mediaId }: { id: string; mediaId: string }) =>
      proposalsClientApi.removeItem(id, mediaId),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};

export const useReorderProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      mediaIds,
      plans,
      dates,
      quantities,
    }: {
      id: string;
      mediaIds: string[];
      plans?: Record<string, number>;
      dates?: Record<
        string,
        { start_date: string | null; end_date: string | null }
      >;
      quantities?: Record<string, number | null>;
    }) => proposalsClientApi.reorder(id, mediaIds, plans, dates, quantities),
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

export const useUploadCounterProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      proposalsApi.uploadCounterProposal(id, file),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.adminDetail(id) });
    },
  });
};

export const useAcceptProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsApi.accept(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.adminDetail(id) });
      qc.invalidateQueries({ queryKey: proposalsKeys.list() });
    },
  });
};

export const useCancelSubmitProposal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proposalsClientApi.cancelSubmit(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: proposalsKeys.myList() });
      qc.invalidateQueries({ queryKey: proposalsKeys.detail(id) });
    },
  });
};
