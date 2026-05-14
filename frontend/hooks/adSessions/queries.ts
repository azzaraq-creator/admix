import { useQuery } from "@tanstack/react-query";

import { adSessionsApi } from "./apis";
import { adSessionsKeys } from "./keys";

export const useAdSessions = () =>
  useQuery({
    queryKey: adSessionsKeys.list(),
    queryFn: adSessionsApi.list,
    staleTime: 30 * 1000,
  });

export const useAdSession = (id: string | null) =>
  useQuery({
    queryKey: adSessionsKeys.detail(id ?? ""),
    queryFn: () => adSessionsApi.get(id as string),
    enabled: !!id,
  });
