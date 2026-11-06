"use client";

import { Label, Radio, RadioGroup } from "@heroui/react";
import { useState } from "react";

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

/** 사업자 등록이 필요한 유형 — 바꿀 때 안내만 붙인다(인증 상태는 그대로 남는다). */
const NEEDS_LICENSE: Partial<Record<MemberCategory, string>> = {
  advertiser: "사업자등록증을 올리고 관리자 확인을 통과하면 AI 믹시를 무제한으로 쓸 수 있어요.",
  agency: "사업자등록증을 올리고 관리자 확인을 통과하면 AI 믹시를 무제한으로 쓸 수 있어요.",
  media_owner: "매체를 등록하려면 사업자등록증을 올려 주세요.",
  partner: "매장을 등록하려면 사업자등록증을 올려 주세요. 콜라보 메뉴에서 매장을 등록할 수 있어요.",
};

/** 회원 유형 바꾸기 — 가입 후에도 언제든 직접 바꾼다. */
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
              success(`회원 유형을 ${MEMBER_CATEGORY_LABEL[value]}(으)로 바꿨어요.`);
              close(false);
            },
            onError: (e) => error(extractApiError(e, "회원 유형을 바꾸지 못했어요.")),
          },
        );
      }}
    >
      <RadioGroup
        aria-label="회원 유형"
        value={value}
        onChange={(next) => {
          if (isMemberCategory(next)) setPicked(next);
        }}
        className="flex flex-col gap-[8px]"
      >
        {MEMBER_CATEGORIES.map((c) => (
          <Radio key={c.value} value={c.value} className="group mt-0 w-full">
            <Radio.Content
              className={cn(
                "flex w-full cursor-pointer items-center gap-[10px] rounded-[15px] border border-gray-200 px-[14px] py-[10px] transition-colors data-[hovered=true]:border-gray-300",
                "group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50",
              )}
            >
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <div className="flex min-w-0 flex-1 flex-col">
                <Label className="cursor-pointer text-[14px] font-semibold text-gray-900">
                  {c.label}
                  {c.value === current && (
                    <span className="ml-[6px] text-[12px] font-medium text-gray-400">
                      지금 유형
                    </span>
                  )}
                </Label>
                <span className="text-[12px] text-gray-500">
                  {c.description.join(" ")}
                </span>
              </div>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>
      {value && value !== current && NEEDS_LICENSE[value] && (
        <p className="mt-[12px] rounded-[12px] bg-gray-50 px-[12px] py-[8px] text-[12px] leading-[18px] text-gray-600">
          {NEEDS_LICENSE[value]}
        </p>
      )}
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
