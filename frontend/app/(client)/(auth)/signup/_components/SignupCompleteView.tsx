"use client";

import { useRouter } from "next/navigation";

import { useMe } from "@/hooks/auth";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";
import { cn } from "@/lib/utils";

import { SignupShell } from "./SignupShell";
import {
  CardHeading,
  CategoryBadge,
  PrimaryAction,
  RADIUS,
  SignupCard,
} from "./signupUi";

/** 시안(00. 회원가입 - 완료). */
export function SignupCompleteView() {
  const router = useRouter();
  const { data: me } = useMe();
  const categoryLabel = me ? MEMBER_CATEGORY_LABEL[me.member_category] : null;

  return (
    <SignupShell step={5} hideLoginLink>
      <SignupCard className="items-center">
        <p aria-hidden className="text-[40px] leading-none">
          🎉
        </p>
        <CardHeading
          center
          title="회원가입이 완료되었습니다."
          description="ADMIX에서 원하는 옥외광고 매체를 찾아보세요."
        />

        {me && (
          // 요약 줄 높이 52px → 곡률 23px.
          <div
            className={cn(
              "flex w-full flex-wrap items-center justify-between gap-[8px] bg-primary-50 p-[16px]",
              RADIUS.h52,
            )}
          >
            <div className="flex items-center gap-[10px]">
              {categoryLabel && <CategoryBadge>{categoryLabel}</CategoryBadge>}
              <span className="text-[13px] text-black-900">
                {categoryLabel
                  ? `${categoryLabel}로 가입하셨습니다.`
                  : "가입하셨습니다."}
              </span>
            </div>
            <span className="truncate text-[13px] text-black-500">
              {me.email}
            </span>
          </div>
        )}

        {/* AI 믹시·ADMIX 시작하기가 같은 기능이라 버튼 하나로 합쳤다.
            가입이 끝나면 이미 로그인된 상태라 로그인 창 대신 홈(대시보드)으로 보낸다. */}
        <PrimaryAction label="ADMIX 시작하기" onPress={() => router.push("/")} />
      </SignupCard>
    </SignupShell>
  );
}
