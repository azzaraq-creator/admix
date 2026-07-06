"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type SVGProps } from "react";

import { LogoFull, XIcon } from "@/components/icons";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { authApi, authKeys, useLogin } from "@/hooks/auth";
import { cn } from "@/lib/utils";
import { setTokens } from "@/lib/userToken";

import { setLoginModalOpen, useLoginModalOpen } from "./useLoginModal";

function KakaoIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="0" y="0" width="24" height="24" rx="6" fill="#FEE500" />
      <path
        d="M12 5.8c-3.98 0-7.2 2.55-7.2 5.69 0 2.03 1.35 3.81 3.38 4.82-.15.51-.54 1.97-.62 2.28-.1.38.14.38.29.27.12-.08 1.92-1.31 2.7-1.83.46.07.94.1 1.45.1 3.98 0 7.2-2.55 7.2-5.69S15.98 5.8 12 5.8Z"
        fill="#3C1E1E"
      />
    </svg>
  );
}

function NaverIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x="1.5" y="1.5" width="21" height="21" rx="4.5" fill="#00C300" />
      <path d="M7 7h3l4 5.8V7h3v10h-3l-4-5.8V17H7V7Z" fill="#fff" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 8 6" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        d="M1 3.2 2.9 5 7 1"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const inputClass =
  "w-full rounded-[8px] border px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-black outline-none placeholder:text-placeholder";

function getErrorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

export function LoginModal() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const open = useLoginModalOpen();
  const loginMutation = useLogin();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [credentialError, setCredentialError] = useState(false);
  const [restrictedOpen, setRestrictedOpen] = useState(false);
  const [snsPending, setSnsPending] = useState(false);

  const handleSnsLogin = async (provider: "kakao" | "naver") => {
    setSnsPending(true);
    try {
      window.location.href = await authApi.snsAuthorizeUrl(provider);
    } catch {
      setSnsPending(false);
    }
  };

  const closeLogin = (value: boolean) => {
    setLoginModalOpen(value);
    if (!value) setCredentialError(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setCredentialError(true);
      return;
    }
    setCredentialError(false);
    try {
      const res = await loginMutation.mutateAsync({
        email,
        password,
        remember: keepLoggedIn,
      });
      setTokens(res.access_token, res.refresh_token, keepLoggedIn);
      // 로그인 직후 me 캐시를 즉시 채워 사이드바가 바로 반영되도록 한다.
      // useMe 는 enabled:!!token 이라 로그인 전엔 disabled 상태이고,
      // disabled 옵저버는 invalidate 로 refetch 되지 않으므로 fetchQuery 로 강제 조회.
      // me 조회 실패가 로그인 성공을 뒤집지 않도록 catch 로 흡수.
      await queryClient
        .fetchQuery({ queryKey: authKeys.me, queryFn: authApi.me })
        .catch(() => {});
      setEmail("");
      setPassword("");
      setLoginModalOpen(false);
    } catch (error) {
      if (getErrorStatus(error) === 403) {
        setLoginModalOpen(false);
        setRestrictedOpen(true);
        return;
      }
      setCredentialError(true);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={closeLogin}>
        <DialogContent className="flex w-[452px] max-w-[calc(100vw-32px)] flex-col items-center gap-[32px] rounded-[12px] px-[16px] py-[24px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
          <div className="flex w-full items-center justify-between">
            <LogoFull className="h-[24px]" />
            <DialogClose
              aria-label="닫기"
              className="flex size-[24px] items-center justify-center text-black outline-none"
            >
              <XIcon className="size-[24px]" />
            </DialogClose>
          </div>

          <div className="flex w-full flex-col gap-[24px]">
            <form onSubmit={handleSubmit} className="flex w-full flex-col gap-[16px]">
              <div className="flex w-full flex-col gap-[12px]">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (credentialError) setCredentialError(false);
                  }}
                  placeholder="이메일을 입력해 주세요."
                  className={cn(
                    inputClass,
                    credentialError ? "border-[#ff2c20] bg-[#fff2f1]" : "border-stroke",
                  )}
                />
                <div className="flex w-full flex-col gap-[6px]">
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (credentialError) setCredentialError(false);
                    }}
                    placeholder="비밀번호를 입력해 주세요."
                    className={cn(
                      inputClass,
                      credentialError
                        ? "border-[#ff2c20] bg-[#fff2f1]"
                        : "border-stroke",
                    )}
                  />
                  {credentialError && (
                    <p className="w-full text-[14px] font-medium leading-[20px] text-[#ff2c20]">
                      아이디 또는 비밀번호를 확인해 주세요
                    </p>
                  )}
                </div>
                <div className="flex w-full items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setKeepLoggedIn((prev) => !prev)}
                    className="flex items-center gap-[9px]"
                  >
                    <span
                      className={`flex size-[16.667px] items-center justify-center rounded-[4px] border ${
                        keepLoggedIn
                          ? "border-primary bg-primary text-white"
                          : "border-stroke bg-white text-transparent"
                      }`}
                    >
                      <CheckIcon className="h-[5.5px] w-[7px]" />
                    </span>
                    <span className="text-[14px] font-medium leading-[20px] text-black">
                      로그인 유지
                    </span>
                  </button>
                  <button
                    type="button"
                    className="text-[14px] font-medium leading-[20px] text-black"
                  >
                    비밀번호 재설정
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loginMutation.isPending}
                className="flex w-full items-center justify-center rounded-[8px] bg-primary px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-white disabled:opacity-60"
              >
                {loginMutation.isPending ? "로그인 중..." : "로그인"}
              </button>
            </form>

            <div className="h-px w-full bg-stroke" />

            <div className="flex w-full items-center justify-center gap-[8px]">
              <button
                type="button"
                aria-label="카카오로 로그인"
                onClick={() => handleSnsLogin("kakao")}
                disabled={snsPending}
                className="flex items-center gap-[8px] rounded-[8px] border border-stroke px-[20px] py-[16px] disabled:opacity-60"
              >
                <KakaoIcon className="size-[24px] shrink-0" />
              </button>
              <button
                type="button"
                aria-label="네이버로 로그인"
                onClick={() => handleSnsLogin("naver")}
                disabled={snsPending}
                className="flex items-center gap-[8px] rounded-[8px] border border-stroke px-[20px] py-[16px] disabled:opacity-60"
              >
                <NaverIcon className="size-[24px] shrink-0" />
              </button>
            </div>

            <div className="flex w-full items-center justify-center gap-[8px] text-[16px] leading-[24px]">
              <span className="font-normal text-black">
                아직 회원이 아니신가요?
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginModalOpen(false);
                  router.push("/signup");
                }}
                className="cursor-pointer font-bold text-primary"
              >
                회원가입
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={restrictedOpen} onOpenChange={setRestrictedOpen}>
        <DialogContent className="flex w-[400px] max-w-[calc(100vw-32px)] flex-col items-center gap-[20px] px-[30px] py-[20px]">
          <div className="flex w-full flex-col items-start gap-[12px] text-black">
            <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px]">
              서비스 이용이 제한되었습니다.
            </p>
            <div className="text-[16px] font-medium leading-[24px]">
              <p>운영 정책 위반으로 인해 회원님의 계정 이용이 일시적으로 제한되었습니다.</p>
              <p>문의가 필요한 경우 [문의하기]로 문의해 주세요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRestrictedOpen(false)}
            className="flex h-[48px] w-full items-center justify-center rounded-[8px] bg-primary px-[16px] py-[12px] text-[16px] font-medium leading-[24px] text-white"
          >
            확인
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
