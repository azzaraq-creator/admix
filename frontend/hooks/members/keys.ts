export const membersKeys = {
  all: ["members"] as const,
  list: () => [...membersKeys.all, "list"] as const,
  detail: (id: string) => [...membersKeys.all, "detail", id] as const,
};
