export const inquiriesKeys = {
  all: ["inquiries"] as const,
  list: () => [...inquiriesKeys.all, "list"] as const,
  detail: (id: string) => [...inquiriesKeys.all, "detail", id] as const,
  myList: () => [...inquiriesKeys.all, "my", "list"] as const,
  myDetail: (id: string) => [...inquiriesKeys.all, "my", "detail", id] as const,
};
