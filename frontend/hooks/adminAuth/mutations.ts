import { useMutation } from "@tanstack/react-query";

import { adminAuthApi } from "./apis";

export const useAdminLogin = () =>
  useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      adminAuthApi.login(email, password),
  });
