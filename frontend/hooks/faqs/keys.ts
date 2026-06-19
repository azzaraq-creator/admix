export const faqsKeys = {
  all: ["faqs"] as const,
  list: () => [...faqsKeys.all, "list"] as const,
  detail: (id: string) => [...faqsKeys.all, "detail", id] as const,
};
