export const proposalsKeys = {
  all: ["proposals"] as const,
  list: () => [...proposalsKeys.all, "list"] as const,
  adminDetail: (id: string) =>
    [...proposalsKeys.all, "admin-detail", id] as const,
  // 클라이언트(장바구니) — admin list 와 키 분리
  myList: () => [...proposalsKeys.all, "my"] as const,
  detail: (id: string) => [...proposalsKeys.all, "detail", id] as const,
};
