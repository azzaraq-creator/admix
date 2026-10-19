import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  proposalsApi,
  proposalsClientApi,
  type ProposalDetail,
  type ProposalListParams,
} from "./apis";
import { proposalsKeys } from "./keys";

export const useAdminProposals = (params?: ProposalListParams) =>
  useQuery({
    queryKey: proposalsKeys.list(params),
    queryFn: () => proposalsApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useAdminProposalDetail = (id: string | null) =>
  useQuery({
    queryKey: proposalsKeys.adminDetail(id ?? ""),
    queryFn: () => proposalsApi.get(id as string),
    enabled: !!id,
  });

export const useMyProposals = () =>
  useQuery({
    queryKey: proposalsKeys.myList(),
    queryFn: proposalsClientApi.list,
    staleTime: 10 * 1000,
  });

/**
 * demo — 가이드의 예시 기획안: 서버에 묻지 않고 이 값을 그대로 쓴다.
 */
export const useProposalDetail = (
  id: string | null,
  demo?: ProposalDetail | null,
) =>
  useQuery({
    queryKey: proposalsKeys.detail(id ?? ""),
    queryFn: () => proposalsClientApi.get(id as string),
    enabled: !!id && !demo,
    initialData: demo ?? undefined,
  });
