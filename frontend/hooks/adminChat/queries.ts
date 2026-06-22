import { useQuery } from "@tanstack/react-query";

import { adminChatApi } from "./apis";
import { adminChatKeys } from "./keys";

export const useAdminChatOverview = () =>
  useQuery({
    queryKey: adminChatKeys.overview(),
    queryFn: adminChatApi.overview,
    staleTime: 30 * 1000,
  });

export const useAdminChatUser = (userId: string | null) =>
  useQuery({
    queryKey: adminChatKeys.user(userId ?? ""),
    queryFn: () => adminChatApi.user(userId as string),
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

export const useAdminChatSession = (sessionId: string | null) =>
  useQuery({
    queryKey: adminChatKeys.session(sessionId ?? ""),
    queryFn: () => adminChatApi.session(sessionId as string),
    enabled: !!sessionId,
    staleTime: 30 * 1000,
  });
