"use client";

import { useRouter } from "next/navigation";

import { LogoFull } from "@/components/icons";
import { useMe } from "@/hooks/auth";

export function SignupCompleteView() {
  const router = useRouter();
  const { data: me } = useMe();
  const name = me?.name?.trim() || "회원";

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-white sm:bg-[#ebf8f8]">
      <div className="flex min-h-screen w-full flex-col items-center justify-center gap-[32px] bg-white px-[16px] py-[24px] sm:min-h-0 sm:w-[470px] sm:gap-[120px] sm:rounded-[24px] sm:px-[36px] sm:py-[46px]">
        <div className="flex w-full items-center justify-center py-[24px]">
          <LogoFull />
        </div>

        <div className="flex w-full flex-col items-center text-center text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black sm:gap-[12px] sm:text-[32px] sm:font-bold sm:leading-[40px] sm:tracking-[-0.16px]">
          <p>
            <span className="text-primary">{name}</span>님
          </p>
          <p>회원님에게 적합한</p>
          <p>광고 매체를 추천해드릴게요!</p>
        </div>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex w-full cursor-pointer items-center justify-center rounded-[8px] bg-primary px-[24px] py-[14px] text-[16px] font-bold leading-[24px] tracking-[-0.4px] text-white sm:py-[16px] sm:font-semibold sm:tracking-normal"
        >
          시작하기
        </button>
      </div>
    </main>
  );
}
