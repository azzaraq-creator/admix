import { useQuery } from "@tanstack/react-query";

import { faqsApi } from "./apis";
import { faqsKeys } from "./keys";

export const useFaqs = () =>
  useQuery({
    queryKey: faqsKeys.list(),
    queryFn: () => faqsApi.list(),
    staleTime: 30 * 1000,
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
