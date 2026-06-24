import { useMutation } from "@tanstack/react-query";

import { authApi, type RegisterPayload } from "./apis";

export const useLogin = () =>
  useMutation({
    mutationFn: ({
      email,
      password,
      remember,
    }: {
      email: string;
      password: string;
      remember: boolean;
    }) => authApi.login(email, password, remember),
  });

export const useRegister = () =>
  useMutation({
    mutationFn: (payload: RegisterPayload) => authApi.register(payload),
  });
