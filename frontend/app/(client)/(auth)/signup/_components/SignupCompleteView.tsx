"use client";

import { Button } from "@heroui/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import { dismissPartnerResume } from "@/app/(client)/partners/_components/PartnerResumeModal";
import { useMe } from "@/hooks/auth";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";
import { PARTNERS_DASHBOARD_HREF } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { PARTNER_AGREEMENT_HREF, isCollabSignup } from "./CategoryStep";
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
 * 제휴사(콜라보)는 여기서 기본협약 동의로 넘어간다 — 큰 버튼 "기본협약 하기", 아래 "나중에 하기"(admix 첫 화면).
 * 매장은 담당자가 어드민에서 등록 · 연결한다(2026-11-09, 069).
 * 나중에 하기를 고르면 첫 화면에서 "진행 중인 기본협약 동의" 창(PartnerResumeModal)이 곧바로 또 묻지 않게
 * 이 탭에서는 닫아 둔다 — 다시 로그인하면 묻는다.
 * 광고주는 "admix 시작하기" 아래에 "Collaboration 시작하기"(콜라보 대시보드)를 하나 더 둔다(11-09 사용자).
 */

/** "Collaboration" 글자 — 사이드바 · 콜라보 로고와 같은 HS활공명조(파일이 Regular 하나라 굵기는 브라우저가 만든다). */
function CollabWord() {
  return (
    <span className={cn(collabScript.className, "font-bold tracking-[0.04em]")}>
      Collaboration
    </span>
  );
}

/**
 * 시작하기 버튼 — 연보라 바탕 · 보라 글자, 마우스를 올리면 보라 바탕 · 흰 글자에 그림자(11-09 사용자).
 * 예전 admix 시작하기의 늘 깔린 보라 그림자는 뺐다. admix · Collaboration 두 버튼이 같은 모양.
 * 높이 52px → 곡률 23px, 모바일 44px → 19px(가입 단계의 큰 버튼과 같다).
 */
function StartButton({
  onPress,
  children,
}: {
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="tertiary"
      fullWidth
      onPress={onPress}
      className={cn(
        "h-[52px] bg-primary-100 text-[15px] font-bold text-primary-500 shadow-none transition-[background-color,color,box-shadow] duration-200",
        "data-[hovered=true]:bg-primary-500 data-[hovered=true]:text-white data-[hovered=true]:shadow-[0px_12px_14px_rgba(163,59,209,0.2)]",
        RADIUS.h52,
        "max-sm:h-[44px] rounded-[23px] max-sm:rounded-[19px] max-sm:text-[14px]",
      )}
    >
      {children}
    </Button>
  );
}
export function SignupCompleteView() {
  const router = useRouter();
  // 콜라보에서 시작한 가입이면 위 로고도 콜라보 로고(useFinishSignup 이 ?from=collab 을 이어 준다).
  const collab = isCollabSignup(useSearchParams());
  const { data: me } = useMe();
  const categoryLabel = me ? MEMBER_CATEGORY_LABEL[me.member_category] : null;
  const partner = me?.member_category === "partner";
  const advertiser = me?.member_category === "advertiser";

  return (
    <SignupShell step={5} hideLoginLink collab={collab}>
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
                ? "사업자등록증을 올리고 기본협약에 동의하면 담당자가 매장을 연결해 드려요"
                : advertiser
                  ? // 광고주 — 매체 · 콜라보 매장을 한 문장으로(어디서 하는지는 아래 두 버튼이 나눈다, 11-09 사용자).
                    "admix에서 옥외광고 매체부터 콜라보 매장까지 찾아보세요"
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
              label="기본협약 하기"
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
                "max-sm:h-[40px] rounded-[19px] max-sm:rounded-[17px] max-sm:text-[13px]",
              )}
            >
              나중에 하기
            </Button>
          </div>
        ) : (
          // 모바일은 카드가 화면 아래까지 늘어나므로 버튼을 카드 맨 아래에 붙인다.
          <div className="flex w-full flex-col gap-[8px] pt-[4px] max-sm:mt-auto max-sm:pt-0">
            <StartButton onPress={() => router.push("/")}>
              admix 시작하기
            </StartButton>
            {advertiser && (
              <StartButton onPress={() => router.push(PARTNERS_DASHBOARD_HREF)}>
                {/* 버튼은 자식 사이에 간격(gap)을 두므로 한 덩어리로 묶어 글자 사이를 한 칸만 띄운다. */}
                <span>
                  <CollabWord /> 시작하기
                </span>
              </StartButton>
            )}
          </div>
        )}
      </SignupCard>
    </SignupShell>
  );
}
