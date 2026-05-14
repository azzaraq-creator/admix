export const adSessionsKeys = {
  all: ["adSessions"] as const,
  list: () => [...adSessionsKeys.all, "list"] as const,
  detail: (id: string) => [...adSessionsKeys.all, "detail", id] as const,
};
