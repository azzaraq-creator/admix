import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { faqsApi, type FaqListParams } from "./apis";
import { faqsKeys } from "./keys";

export const useFaqs = (params?: FaqListParams) =>
  useQuery({
    queryKey: faqsKeys.adminList(params),
    queryFn: () => faqsApi.adminList(params),
    staleTime: 30 * 1000,
    placeholderData: keepPreviousData,
  });

export const usePublishedFaqs = () =>
  useQuery({
    queryKey: [...faqsKeys.list(), "published"],
    queryFn: () => faqsApi.list({ published_only: true }),
    staleTime: 60 * 1000,
  });

export const useFaq = (id: string | null) =>
  useQuery({
    queryKey: faqsKeys.detail(id ?? ""),
    queryFn: () => faqsApi.get(id as string),
    enabled: !!id,
  });
