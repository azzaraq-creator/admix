import { useQuery } from "@tanstack/react-query";

import { proposalsApi, proposalsClientApi } from "./apis";
import { proposalsKeys } from "./keys";

export const useAdminProposals = () =>
  useQuery({
    queryKey: proposalsKeys.list(),
    queryFn: proposalsApi.list,
    staleTime: 30 * 1000,
  });

export const useMyProposals = () =>
  useQuery({
    queryKey: proposalsKeys.myList(),
    queryFn: proposalsClientApi.list,
    staleTime: 10 * 1000,
  });

export const useProposalDetail = (id: string | null) =>
  useQuery({
    queryKey: proposalsKeys.detail(id ?? ""),
    queryFn: () => proposalsClientApi.get(id as string),
    enabled: !!id,
  });
