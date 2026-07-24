import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { membersApi, type MemberListParams } from "./apis";
import { membersKeys } from "./keys";

export const useMembers = (params?: MemberListParams) =>
  useQuery({
    queryKey: membersKeys.list(params),
    queryFn: () => membersApi.list(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const useMember = (id: string | null) =>
  useQuery({
    queryKey: membersKeys.detail(id ?? ""),
    queryFn: () => membersApi.get(id as string),
    enabled: !!id,
  });
