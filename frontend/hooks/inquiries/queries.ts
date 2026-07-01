import { useQuery } from "@tanstack/react-query";

import { inquiriesApi, inquiriesClientApi } from "./apis";
import { inquiriesKeys } from "./keys";

export const useAdminInquiries = () =>
  useQuery({
    queryKey: inquiriesKeys.list(),
    queryFn: inquiriesApi.list,
    staleTime: 30 * 1000,
  });

export const useInquiry = (id: string | null) =>
  useQuery({
    queryKey: inquiriesKeys.detail(id ?? ""),
    queryFn: () => inquiriesApi.get(id as string),
    enabled: !!id,
  });

export const useMyInquiries = () =>
  useQuery({
    queryKey: inquiriesKeys.myList(),
    queryFn: inquiriesClientApi.myList,
    staleTime: 30 * 1000,
  });

export const useMyInquiry = (id: string | null) =>
  useQuery({
    queryKey: inquiriesKeys.myDetail(id ?? ""),
    queryFn: () => inquiriesClientApi.myGet(id as string),
    enabled: !!id,
  });
