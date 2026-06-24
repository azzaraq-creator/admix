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

export const useChangePassword = () =>
  useMutation({
    mutationFn: ({
      currentPassword,
      newPassword,
    }: {
      currentPassword: string;
      newPassword: string;
    }) => authApi.changePassword(currentPassword, newPassword),
  });

export const useUpdateProfile = () =>
  useMutation({
    mutationFn: (payload: {
      name?: string;
      company_name?: string;
      phone?: string;
    }) => authApi.updateProfile(payload),
  });
