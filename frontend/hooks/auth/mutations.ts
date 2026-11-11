import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";

import { announceLogout } from "@/lib/authChannel";
import { clearSessionId } from "@/lib/session";
import { clearUserToken, getRefreshToken } from "@/lib/userToken";

import {
  authApi,
  type ProfileUpdatePayload,
  type RegisterPayload,
} from "./apis";
import { authKeys } from "./keys";

/**
 * 로그아웃 — 끝나면 admix 첫 화면("/")으로.
 * 콜라보 화면(/partners…)에서 로그아웃하면 비회원용 콜라보 소개(/partners)로 간다(11-08 사용자).
 */
export const useLogout = () => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  return async () => {
    const to = pathname.startsWith("/partners") ? "/partners" : "/";
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        await authApi.logout(refreshToken);
      } catch {
        // 폐기 실패해도 로컬 로그아웃은 진행
      }
    }
    clearUserToken();
    clearSessionId();
    // 같은 계정으로 열린 다른 탭에 바로 알린다 — 콜라보 화면은 받자마자 비회원 소개로(PartnersSessionWatch).
    announceLogout();
    queryClient.setQueryData(authKeys.me, null);
    queryClient.clear();
    router.push(to);
  };
};

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
    mutationFn: (payload: ProfileUpdatePayload) =>
      authApi.updateProfile(payload),
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

export const useUploadBusinessCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => authApi.uploadBusinessCard(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
};

export const useDeleteBusinessCard = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.deleteBusinessCard(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.me });
    },
  });
};
