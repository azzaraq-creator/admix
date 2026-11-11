"use client";

import { RadioGroup } from "@heroui/react";
import { Fragment, useState } from "react";

import {
  CATEGORY_GROUPS,
  CategoryCard,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";
import { HEROUI_ACCENT_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";
import { openMemberPlanModal } from "@/components/common/MemberPlanModal";
import { useUpdateProfile } from "@/hooks/auth";
import { useSonner } from "@/hooks/useSonner";
import { extractApiError } from "@/lib/apiError";
import {
  isMemberCategory,
  MEMBER_CATEGORIES,
  MEMBER_CATEGORY_LABEL,
  type MemberCategory,
} from "@/lib/memberCategory";
import { cn } from "@/lib/utils";

import { ProfileModalShell } from "./ProfileModalShell";

/**
 * 회원 유형 바꾸기 — 가입 후에도 언제든 직접 바꾼다.
 * 유형을 고를 때 아래에 붙던 사업자등록증 안내(광고주 · 대행사 · 매체사 · 제휴사)는 뺐다(11-09 사용자: "이런 거 빼줘, 다른 것도").
 */
export function CategoryChangeModal({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MemberCategory | undefined;
}) {
  const [picked, setPicked] = useState<MemberCategory | null>(null);
  const value = picked ?? current ?? null;
  const update = useUpdateProfile();
  const { success, error } = useSonner();

  const close = (next: boolean) => {
    if (!next) setPicked(null);
    onOpenChange(next);
  };

  return (
    <ProfileModalShell
      open={open}
      onOpenChange={close}
      title="회원 유형 바꾸기"
      description="회원 유형에 따라 이용할 수 있는 기능이 달라요."
      submitLabel="바꾸기"
      submitDisabled={!value || value === current}
      submitPending={update.isPending}
      pendingLabel="바꾸는 중"
      onSubmit={() => {
        if (!value) return;
        update.mutate(
          { member_category: value },
          {
            onSuccess: () => {
              success(
                `회원 유형을 ${MEMBER_CATEGORY_LABEL[value]}(으)로 바꿨어요.`,
              );
              close(false);
            },
            onError: (e) =>
              error(extractApiError(e, "회원 유형을 바꾸지 못했어요.")),
          },
        );
      }}
    >
      {/* 가입 화면 회원 유형 단계와 같은 UI — 같은 카드(CategoryCard) · 같은 묶음과 구분선(11-09 사용자).
          라디오 색은 HeroUI 기본값(HEROUI_ACCENT_SCOPE). 창이 가입 카드보다 좁아 이름 아래 설명(stacked)으로 둔다. */}
      <RadioGroup
        aria-label="회원 유형"
        value={value}
        onChange={(next) => {
          if (isMemberCategory(next)) setPicked(next);
        }}
        className={cn(
          "flex w-full flex-col gap-[12px] sm:gap-[14px]",
          HEROUI_ACCENT_SCOPE,
        )}
      >
        {CATEGORY_GROUPS.map((group, i) => (
          <Fragment key={group.join("-")}>
            {i > 0 && (
              <div
                role="separator"
                className="h-px w-full shrink-0 bg-gray-200"
              />
            )}
            <div className="flex w-full flex-col gap-[8px] sm:gap-[10px]">
              {group.map((v) => {
                const category = MEMBER_CATEGORIES.find((c) => c.value === v);
                return category ? (
                  <CategoryCard
                    key={v}
                    category={category}
                    stacked
                    badge={v === current ? "지금 유형" : undefined}
                  />
                ) : null;
              })}
            </div>
          </Fragment>
        ))}
      </RadioGroup>
      <button
        type="button"
        onClick={openMemberPlanModal}
        className="mt-[12px] text-[13px] font-semibold text-primary underline-offset-2 hover:underline"
      >
        회원 유형별 이용 범위 비교하기
      </button>
    </ProfileModalShell>
  );
}
