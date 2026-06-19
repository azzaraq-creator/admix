export const adminAuthKeys = {
  all: ["adminAuth"] as const,
  me: () => [...adminAuthKeys.all, "me"] as const,
};
