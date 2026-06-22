import { useMutation } from "@tanstack/react-query";

import { authApi } from "./apis";

export const useLogin = () =>
  useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authApi.login(email, password),
  });
