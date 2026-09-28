"use client";

import { Button, Separator } from "@heroui/react";

import { MEMBER_CATEGORY_LABEL, type MemberCategory } from "@/lib/memberCategory";
import { cn } from "@/lib/utils";

import { KakaoSymbolIcon, NaverSymbolIcon } from "./signupIcons";
import { CardHeading, CategoryBadge, RADIUS, SignupCard } from "./signupUi";

/** 가입 방식 버튼 — 높이 48px → 곡률 21px. */
const METHOD_BUTTON = cn(
  "h-[48px] gap-[10px] text-[14px] font-semibold data-[disabled=true]:opacity-60",
  RADIUS.h48,
);

/** 2단계 — 시안(00. 회원가입 - 로그인 방식 선택). */
export function MethodStep({
  category,
  snsPending,
  onChangeCategory,
  onSns,
  onEmail,
}: {
  category: MemberCategory;
  snsPending: boolean;
  onChangeCategory: () => void;
  onSns: (provider: "kakao" | "naver") => void;
  onEmail: () => void;
}) {
  return (
    <SignupCard>
      <CardHeading
        title="가입 방식을 선택해 주세요"
        description="선택하신 방식으로 ADMIX 계정을 만듭니다."
      />

      {/* 선택한 유형 줄 — 높이 56px → 곡률 25px. */}
      <div
        className={cn(
          "flex h-[56px] w-full items-center justify-between border border-black-200 bg-white pr-[4px] pl-[16px]",
          RADIUS.h56,
        )}
      >
        <div className="flex items-center gap-[12px]">
          <CategoryBadge>{MEMBER_CATEGORY_LABEL[category]}</CategoryBadge>
          <span className="text-[13px] text-[#71717a]">유형으로 가입합니다</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onPress={onChangeCategory}
          className={cn(
            "h-[40px] px-[12px] text-[13px] font-medium text-[#71717a] data-[hovered=true]:text-black-900",
            RADIUS.h40,
          )}
        >
          변경
        </Button>
      </div>

      <div className="flex w-full flex-col gap-[16px]">
        <Button
          fullWidth
          isDisabled={snsPending}
          onPress={() => onSns("kakao")}
          className={cn(METHOD_BUTTON, "bg-[#fee500] text-[#191600]")}
        >
          <KakaoSymbolIcon className="size-[18px] shrink-0" />
          카카오로 계속하기
        </Button>
        <Button
          fullWidth
          isDisabled={snsPending}
          onPress={() => onSns("naver")}
          className={cn(METHOD_BUTTON, "bg-[#03c75a] text-white")}
        >
          <NaverSymbolIcon className="size-[16px] shrink-0" />
          네이버로 계속하기
        </Button>

        <div className="flex w-full items-center gap-[16px]">
          <Separator className="flex-1 bg-black-200" />
          <span className="text-[13px] text-[#a1a1aa]">또는</span>
          <Separator className="flex-1 bg-black-200" />
        </div>

        <Button
          variant="ghost"
          fullWidth
          onPress={onEmail}
          className={cn(
            METHOD_BUTTON,
            "border border-black-200 bg-white text-[#18181b] data-[hovered=true]:bg-black-50",
          )}
        >
          이메일로 가입하기
        </Button>
      </div>

      <p className="text-center text-[11px] text-[#a1a1aa]">
        가입을 진행하면 서비스 이용약관 및 개인정보 처리방침에 동의하게 됩니다.
      </p>
    </SignupCard>
  );
}
