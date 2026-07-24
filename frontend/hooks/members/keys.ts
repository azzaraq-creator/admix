import type { MemberListParams } from "./apis";

export const membersKeys = {
  all: ["members"] as const,
  list: (params?: MemberListParams) =>
    [...membersKeys.all, "list", params ?? {}] as const,
  detail: (id: string) => [...membersKeys.all, "detail", id] as const,
};
