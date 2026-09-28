"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { LOGIN_HREF } from "@/app/(client)/(main)/_components/useLoginModal";
import { LogoFullDark } from "@/components/icons/LogoFull";
import { cn } from "@/lib/utils";

import { StepCheckIcon } from "./signupIcons";
import { RADIUS } from "./signupUi";

const STEPS = ["유형", "방식", "이메일", "정보", "약관동의"] as const;

/**
 * 단계 표시 — current 이전 단계는 체크, current는 번호가 채워진 보라 점,
 * 이후 단계는 회색 테두리 점. current가 STEPS.length면 모두 완료.
 */
function Stepper({ current }: { current: number }) {
  return (
    <ol aria-label="회원가입 단계" className="flex w-full items-center gap-[6px] overflow-x-auto">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <Fragment key={label}>
            {index > 0 && (
              <li
                aria-hidden
                className={cn(
                  "h-[2px] w-[32px] shrink-0",
                  index <= current ? "bg-primary-500" : "bg-black-200",
                )}
              />
            )}
            <li
              aria-current={active ? "step" : undefined}
              className="flex shrink-0 items-center gap-[6px]"
            >
              {/* 단계 점 24px → 곡률 9px. */}
              <span
                className={cn(
                  "flex size-[24px] items-center justify-center text-[11px] font-bold",
                  RADIUS.h24,
                  done || active
                    ? "bg-primary-500 text-white"
                    : "border border-black-200 bg-white text-black-400",
                )}
              >
                {done ? <StepCheckIcon className="size-[14px]" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-[11px] whitespace-nowrap",
                  done || active ? "font-semibold text-black-900" : "text-black-400",
                )}
              >
                {label}
              </span>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

/** 시안(00. 회원가입) 공통 틀 — 상단 바 + 단계 표시 + (이전) + 카드. */
export function SignupShell({
  step,
  onBack,
  hideLoginLink,
  children,
}: {
  /** 0~4: 진행 중인 단계, 5: 모두 완료. */
  step: number;
  onBack?: () => void;
  hideLoginLink?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col bg-black-50">
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-black-200 bg-white px-[16px] sm:px-[32px]">
        <Link href="/" aria-label="홈">
          <LogoFullDark className="h-[30px]" />
        </Link>
        {!hideLoginLink && (
          <p className="flex items-center gap-[12px] text-[13px] whitespace-nowrap">
            <span className="hidden text-black-500 sm:inline">이미 계정이 있으신가요?</span>
            <Link href={LOGIN_HREF} className="font-bold text-primary-500 underline">
              로그인
            </Link>
          </p>
        )}
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-[16px] py-[40px]">
        <div className="flex w-full max-w-[480px] flex-col gap-[24px]">
          <Stepper current={step} />
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onPress={onBack}
              className="h-auto w-fit min-w-0 p-0 text-[13px] font-medium text-black-500 data-[hovered=true]:bg-transparent data-[hovered=true]:text-black-900"
            >
              ‹ 이전
            </Button>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
