"use client";

import Link from "next/link";

import { openMemberPlanModal } from "@/components/common/MemberPlanModal";
import { PartnersIcon } from "@/components/icons";
import { LOGIN_HREF } from "@/app/(client)/(main)/_components/useLoginModal";
import { useMe } from "@/hooks/auth";
import { MEMBER_CATEGORY_LABEL } from "@/lib/memberCategory";

/** 콜라보 화면을 쓸 수 없는 회원(일반·대행사·매체사)·비회원(매장 상세) 안내. */
export function PartnersNoAccess({ guest = false }: { guest?: boolean }) {
  const { data: me } = useMe();
  return (
    <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center justify-center gap-[12px] py-[48px] text-center">
      <span className="flex size-[56px] items-center justify-center rounded-full bg-primary-50">
        <PartnersIcon className="size-[28px] text-primary" />
      </span>
      <h1 className="text-[20px] font-bold text-gray-900">
        {guest ? "로그인이 필요해요" : "광고주 · 제휴사(콜라보) 전용 메뉴예요"}
      </h1>
      <p className="text-[14px] leading-[22px] break-keep text-gray-500">
        {guest
          ? "콜라보 매장 정보는 광고주 · 제휴사(콜라보) 회원만 볼 수 있어요."
          : `콜라보는 광고주와 제휴사(콜라보) 회원만 이용할 수 있어요.${
              me
                ? ` 지금은 ${MEMBER_CATEGORY_LABEL[me.member_category]} 회원이에요.`
                : ""
            } 회원 정보에서 언제든 회원 유형을 바꿀 수 있어요.`}
      </p>
      <div className="mt-[8px] flex gap-[8px]">
        <button
          type="button"
          onClick={openMemberPlanModal}
          className="h-[40px] rounded-[17px] border border-gray-200 bg-surface px-[16px] text-[14px] font-semibold text-gray-700 hover:bg-gray-50"
        >
          회원 유형 비교
        </button>
        <Link
          href={guest ? LOGIN_HREF : "/profile"}
          className="flex h-[40px] items-center rounded-[17px] bg-primary px-[16px] text-[14px] font-semibold text-white"
        >
          {guest ? "로그인" : "회원 유형 바꾸기"}
        </Link>
      </div>
    </div>
  );
}
