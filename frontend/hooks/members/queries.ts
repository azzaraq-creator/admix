import { useQuery } from "@tanstack/react-query";

import { membersApi } from "./apis";
import { membersKeys } from "./keys";

export const useMembers = () =>
  useQuery({
    queryKey: membersKeys.list(),
    queryFn: membersApi.list,
    staleTime: 30 * 1000,
  });

export const useMember = (id: string | null) =>
  useQuery({
    queryKey: membersKeys.detail(id ?? ""),
    queryFn: () => membersApi.get(id as string),
    enabled: !!id,
  });
