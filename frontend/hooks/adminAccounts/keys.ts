import type { AccountListParams } from "./apis";

export const adminAccountsKeys = {
  all: ["adminAccounts"] as const,
  list: (params?: AccountListParams) =>
    [...adminAccountsKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...adminAccountsKeys.all, "detail", id] as const,
};
