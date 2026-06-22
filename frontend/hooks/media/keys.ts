export const mediaKeys = {
  all: ["media"] as const,
  list: () => [...mediaKeys.all, "list"] as const,
  movingList: () => [...mediaKeys.all, "moving", "list"] as const,
};
