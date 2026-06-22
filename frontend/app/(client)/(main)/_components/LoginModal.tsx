"use client";

import { useState, type FormEvent, type SVGProps } from "react";

import { LogoFull, XIcon } from "@/components/icons";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

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
      <path
        d="M7 7h3l4 5.8V7h3v10h-3l-4-5.8V17H7V7Z"
        fill="#fff"
      />
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
  "w-full rounded-[8px] border border-stroke px-[16px] py-[18px] text-[14px] font-medium leading-[20px] text-[#2f3442] outline-none placeholder:text-[#c9cad3] focus:border-primary";

export function LoginModal() {
  const open = useLoginModalOpen();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => setLoginModalOpen(value)}
    >
      <DialogContent className="flex w-[452px] max-w-[calc(100vw-32px)] flex-col items-center gap-[32px] rounded-[12px] px-[16px] py-[24px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-between">
          <LogoFull className="h-[24px]" />
          <DialogClose
            aria-label="닫기"
            className="flex size-[24px] items-center justify-center text-[#2f3442] outline-none"
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
                onChange={(event) => setEmail(event.target.value)}
                placeholder="이메일을 입력해 주세요."
                className={inputClass}
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호를 입력해 주세요."
                className={inputClass}
              />
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
                  <span className="text-[14px] font-medium leading-[20px] text-[#2f3442]">
                    로그인 유지
                  </span>
                </button>
                <button
                  type="button"
                  className="text-[14px] font-medium leading-[20px] text-[#2f3442]"
                >
                  비밀번호 재설정
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-[8px] bg-primary px-[24px] py-[16px] text-[16px] font-semibold leading-[24px] text-white"
            >
              로그인
            </button>
          </form>

          <div className="h-px w-full bg-stroke" />

          <div className="flex w-full items-center justify-center gap-[8px]">
            <button
              type="button"
              aria-label="카카오로 로그인"
              className="flex items-center gap-[8px] rounded-[8px] border border-stroke px-[20px] py-[16px]"
            >
              <KakaoIcon className="size-[24px] shrink-0" />
            </button>
            <button
              type="button"
              aria-label="네이버로 로그인"
              className="flex items-center gap-[8px] rounded-[8px] border border-stroke px-[20px] py-[16px]"
            >
              <NaverIcon className="size-[24px] shrink-0" />
            </button>
          </div>

          <div className="flex w-full items-center justify-center gap-[8px] text-[16px] leading-[24px]">
            <span className="font-normal text-[#2f3442]">
              아직 회원이 아니신가요?
            </span>
            <button type="button" className="font-bold text-primary">
              회원가입
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
