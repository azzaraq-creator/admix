import type { InquiryListParams } from "./apis";

export const inquiriesKeys = {
  all: ["inquiries"] as const,
  list: (params?: InquiryListParams) =>
    [...inquiriesKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...inquiriesKeys.all, "detail", id] as const,
  myList: () => [...inquiriesKeys.all, "my", "list"] as const,
  myDetail: (id: string) => [...inquiriesKeys.all, "my", "detail", id] as const,
};
