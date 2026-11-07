"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { dismissPartnerResume } from "@/app/(client)/partners/_components/PartnerResumeModal";
import { useMe } from "@/hooks/auth";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";
import { cn } from "@/lib/utils";

import { PARTNER_AGREEMENT_HREF } from "./CategoryStep";
import { SignupShell } from "./SignupShell";
import {
  CardHeading,
  CategoryBadge,
  PrimaryAction,
  RADIUS,
  SignupCard,
} from "./signupUi";

/**
 * 시안(00. 회원가입 - 완료).
 * 제휴사(콜라보)는 여기서 기본협약 동의로 넘어간다 — 큰 버튼 "협약·매장 등록하기", 아래 "나중에 하기"(admix 첫 화면).
 * 나중에 하기를 고르면 첫 화면에서 "진행 중인 기본협약 동의" 창(PartnerResumeModal)이 곧바로 또 묻지 않게
 * 이 탭에서는 닫아 둔다 — 다시 로그인하면 묻는다.
 */
export function SignupCompleteView() {
  const router = useRouter();
  const { data: me } = useMe();
  const categoryLabel = me ? MEMBER_CATEGORY_LABEL[me.member_category] : null;
  const partner = me?.member_category === "partner";

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
            description={
              partner
                ? "기본협약 동의와 매장 등록을 마치면 콜라보에 참여할 수 있어요"
                : "admix에서 원하는 옥외광고 매체를 찾아보세요"
            }
          />

          {/* 모바일은 요약 줄이 좁아 이메일이 잘리므로, 한 박스 안에 가입한 이메일을 크게 두고
            그 아래로 가입 유형 문구를 내린다. */}
          {me && (
            <div className="flex w-full flex-col items-center gap-[4px] rounded-[20px] bg-primary-50 px-[16px] py-[16px] text-center sm:hidden">
              <span className="max-w-full text-[17px] leading-[24px] font-bold break-all text-gray-900">
                {me.email}
              </span>
              <div className="mt-[8px] flex flex-wrap items-center justify-center gap-[6px]">
                {categoryLabel && (
                  <CategoryBadge>{categoryLabel}</CategoryBadge>
                )}
                <span className="text-[13px] text-gray-900">
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
                <span className="text-[13px] text-gray-900">
                  {categoryLabel
                    ? `${categoryLabel}로 가입하셨습니다.`
                    : "가입하셨습니다."}
                </span>
              </div>
              <span className="truncate text-[13px] text-gray-500">
                {me.email}
              </span>
            </div>
          )}
        </div>

        {partner ? (
          <div className="flex w-full flex-col gap-[8px] max-sm:mt-auto">
            <PrimaryAction
              label="협약·매장 등록하기"
              onPress={() => router.push(PARTNER_AGREEMENT_HREF)}
            />
            {/* 버튼 44px → 곡률 19px. 큰 버튼과 겹쳐 보이지 않게 바탕 없는 회색 글자 버튼. */}
            <Button
              variant="ghost"
              fullWidth
              onPress={() => {
                if (me) dismissPartnerResume(me.id);
                router.push("/");
              }}
              className={cn(
                "h-[44px] text-[14px] font-semibold text-gray-500 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-gray-700",
                RADIUS.h44,
                "max-sm:h-[40px] max-sm:rounded-[17px] max-sm:text-[13px]",
              )}
            >
              나중에 하기
            </Button>
          </div>
        ) : (
          <PrimaryAction
            label="admix 시작하기"
            onPress={() => router.push("/")}
          />
        )}
      </SignupCard>
    </SignupShell>
  );
}
