"use client";

import { useRouter } from "next/navigation";

import { SparkleIcon } from "@/components/icons";

export function AiSearchArea() {
  const router = useRouter();
  const goToChat = () => router.push("/fixed");

  return (
    <div className="flex w-full flex-col items-center gap-[16px] sm:gap-[24px]">
      <h1 className="text-[18px] font-bold leading-[28px] tracking-[-0.04px] text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)] sm:text-4xl sm:leading-[40px] sm:tracking-normal">
        AI를 통해 매체를 간편하게 추천받아 보세요!
      </h1>

      <div
        role="button"
        tabIndex={0}
        onClick={goToChat}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goToChat();
          }
        }}
        className="flex w-full min-w-[343px] max-h-[128px] cursor-pointer flex-col gap-[10px] rounded-[24px] border border-primary bg-white px-[24px] py-[16px] drop-shadow-[0px_0px_8px_rgba(0,170,164,0.36)] sm:w-[560px] sm:max-w-none"
      >
        <p className="max-h-[48px] min-h-[48px] w-full text-base font-medium leading-[24px] text-grey-500 sm:min-h-[24px]">
          강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩 하고싶어요
        </p>
        <div className="flex w-full items-center justify-end">
          <span className="flex items-center justify-center gap-[6px] rounded-full bg-primary px-[12px] py-[8px] text-white">
            <SparkleIcon className="size-[16px] shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap">
              AI 생성
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
