export const proposalsKeys = {
  all: ["proposals"] as const,
  list: () => [...proposalsKeys.all, "list"] as const,
};
