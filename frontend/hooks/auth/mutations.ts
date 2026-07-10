import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authApi, type RegisterPayload } from "./apis";
import { authKeys } from "./keys";

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

export const useWithdraw = () =>
  useMutation({
    mutationFn: () => authApi.withdraw(),
  });

export const useRequestPasswordReset = () =>
  useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
  });

export const useConfirmPasswordReset = () =>
  useMutation({
    mutationFn: ({
      token,
      newPassword,
    }: {
      token: string;
      newPassword: string;
    }) => authApi.confirmPasswordReset(token, newPassword),
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

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name?: string;
      company_name?: string;
      phone?: string;
      marketing_consent?: boolean;
    }) => authApi.updateProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
};

export const useUploadBusinessRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => authApi.uploadBusinessRegistration(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
};

export const useCancelBusinessRegistration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.cancelBusinessRegistration(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
};
