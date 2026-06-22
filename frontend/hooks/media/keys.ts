export const mediaKeys = {
  all: ["media"] as const,
  list: () => [...mediaKeys.all, "list"] as const,
  movingList: () => [...mediaKeys.all, "moving", "list"] as const,
  fixedList: () => [...mediaKeys.all, "fixed", "list"] as const,
  detail: (id: string) => [...mediaKeys.all, "detail", id] as const,
};
