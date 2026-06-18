export const adminAccountsKeys = {
  all: ["adminAccounts"] as const,
  list: () => [...adminAccountsKeys.all, "list"] as const,
  detail: (id: string) => [...adminAccountsKeys.all, "detail", id] as const,
};
