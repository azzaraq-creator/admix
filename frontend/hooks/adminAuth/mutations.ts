import { useMutation } from "@tanstack/react-query";

import { adminAuthApi } from "./apis";

export const useAdminLogin = () =>
  useMutation({
    mutationFn: ({
      email,
      password,
      remember,
    }: {
      email: string;
      password: string;
      remember: boolean;
    }) => adminAuthApi.login(email, password, remember),
  });
