import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";

import { announceLogout, announceSwitch } from "@/lib/authChannel";
import { canUsePartners, type MemberCategory } from "@/lib/memberCategory";
import { clearSessionId } from "@/lib/session";
import {
  clearUserToken,
  getPersist,
  getRefreshToken,
  setTokens,
} from "@/lib/userToken";

import {
  authApi,
  type LinkedAccount,
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

/**
 * 슈퍼 계정 "계정 전환"(087) — 같은 묶음의 다른 유형 계정으로 바꾸고 화면을 처음부터 다시 연다.
 * 계정마다 데이터가 따로라 캐시를 버리고 새로 그린다. 콜라보 화면은 콜라보 첫 화면(/partners — 유형에 맞게 보여 준다),
 * admix 화면은 지금 주소 그대로. 같은 브라우저의 다른 탭에도 알려 새 계정으로 다시 그리게 한다(AccountSwitchWatch).
 */
export const useSwitchAccount = () => {
  const pathname = usePathname();
  return useMutation({
    mutationFn: (to: LinkedAccount) =>
      authApi.switchAccount(to.id, getPersist(), getRefreshToken()),
    onSuccess: (res, to) => {
      setTokens(res.access_token, res.refresh_token, getPersist());
      announceSwitch();
      reloadForAccount(pathname, to.member_category);
    },
  });
};

/**
 * 계정이 바뀐 뒤 다시 열 주소 — 콜라보 화면은 콜라보 첫 화면(콜라보를 못 쓰는 유형이면 admix 첫 화면), admix 화면은 지금 주소.
 * category 를 모르면(다른 탭이 알림만 받았을 때) 콜라보 첫 화면 — 거기서 유형에 맞게 안내한다.
 */
export function reloadForAccount(pathname: string, category?: MemberCategory) {
  if (!pathname.startsWith("/partners")) window.location.reload();
  else if (category && !canUsePartners(category)) window.location.assign("/");
  else window.location.assign("/partners");
}

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
