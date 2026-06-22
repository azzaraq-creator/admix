export const adminChatKeys = {
  all: ["adminChat"] as const,
  overview: () => [...adminChatKeys.all, "overview"] as const,
  user: (id: string) => [...adminChatKeys.all, "user", id] as const,
  session: (id: string) => [...adminChatKeys.all, "session", id] as const,
};
