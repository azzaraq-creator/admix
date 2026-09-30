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
        {/* 모바일은 카드가 화면 아래까지 늘어나므로, 축하 문구·가입 정보를 남는 세로 공간의
            가운데에 두고 시작하기 버튼만 아래에 붙인다. */}
        <div className="flex w-full flex-col items-center gap-[16px] max-sm:flex-1 max-sm:justify-center max-sm:gap-[12px]">
          <p aria-hidden className="text-[40px] leading-none">
            🎉
          </p>
          <CardHeading
            center
            title="회원가입이 완료되었어요!"
            description="ADMIX에서 원하는 옥외광고 매체를 찾아보세요"
          />

          {/* 모바일은 요약 줄이 좁아 이메일이 잘리므로, 한 박스 안에 가입한 이메일을 크게 두고
            그 아래로 가입 유형 문구를 내린다. */}
          {me && (
            <div className="flex w-full flex-col items-center gap-[4px] rounded-[20px] bg-primary-50 px-[16px] py-[16px] text-center sm:hidden">
              <span className="max-w-full text-[17px] leading-[24px] font-bold break-all text-black-900">
                {me.email}
              </span>
              <div className="mt-[8px] flex flex-wrap items-center justify-center gap-[6px]">
                {categoryLabel && (
                  <CategoryBadge>{categoryLabel}</CategoryBadge>
                )}
                <span className="text-[13px] text-black-900">
                  {categoryLabel
                    ? `${categoryLabel}로 가입하셨습니다.`
                    : "가입하셨습니다."}
                </span>
              </div>
            </div>
          )}

          {me && (
            // 요약 줄 높이 52px → 곡률 23px.
            <div
              className={cn(
                "flex w-full flex-wrap items-center justify-between gap-[8px] bg-primary-50 p-[16px] max-sm:hidden",
                RADIUS.h52,
              )}
            >
              <div className="flex items-center gap-[10px]">
                {categoryLabel && (
                  <CategoryBadge>{categoryLabel}</CategoryBadge>
                )}
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
        </div>

        <PrimaryAction
          label="ADMIX 시작하기"
          onPress={() => router.push("/")}
        />
      </SignupCard>
    </SignupShell>
  );
}
