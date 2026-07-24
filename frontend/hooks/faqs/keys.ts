import type { FaqListParams } from "./apis";

export const faqsKeys = {
  all: ["faqs"] as const,
  list: () => [...faqsKeys.all, "list"] as const,
  adminList: (params?: FaqListParams) =>
    [...faqsKeys.all, "admin", "list", params ?? {}] as const,
  detail: (id: string) => [...faqsKeys.all, "detail", id] as const,
};
