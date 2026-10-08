"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { CircleAlertIcon, RotateCwIcon } from "@/components/icons";

export function LoadingState() {
  return (
    <div className="flex min-h-[240px] w-full flex-1 items-center justify-center py-[80px]">
      <div className="size-[36px] animate-spin rounded-full border-[3px] border-gray-200 border-t-primary" />
    </div>
  );
}

/**
 * 화면을 불러오지 못했을 때(라우트 error.tsx). 색은 절제해 회색 톤으로 두고,
 * 바로 다시 시도하거나 홈으로 빠져나갈 수 있게 한다. 입력칸·버튼 모서리는 높이/2-3px.
 */
export function ErrorState({
  title = "페이지를 불러오지 못했어요",
  message = "일시적인 문제일 수 있어요. 잠시 후 다시 시도해 주세요.",
  onRetry,
  homeHref = "/",
  digest,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** "홈으로" 버튼이 갈 곳. 관리자 화면은 관리자 홈으로 보낸다. */
  homeHref?: string;
  /** Next.js 서버 오류 식별자 — 문의할 때 알려 줄 수 있게 작게 보여 준다. */
  digest?: string;
}) {
  const router = useRouter();

  return (
    <div
      role="alert"
      className="flex min-h-[240px] w-full flex-1 flex-col items-center justify-center bg-gray-50 px-[20px] py-[80px]"
    >
      <div className="flex w-full max-w-[400px] flex-col items-center text-center">
        <span className="flex size-[56px] items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500">
          <CircleAlertIcon className="size-[24px]" />
        </span>
        <h1 className="mt-[20px] text-[20px] leading-[28px] font-bold text-gray-900">
          {title}
        </h1>
        <p className="mt-[8px] text-[14px] leading-[22px] text-gray-500">
          {message}
        </p>

        <div className="mt-[28px] flex w-full gap-[8px] sm:w-auto">
          {onRetry && (
            <Button
              variant="primary"
              onPress={onRetry}
              className="h-[40px] flex-1 gap-[6px] rounded-[17px] bg-primary px-[18px] text-[14px] font-semibold text-white sm:flex-none"
            >
              <RotateCwIcon className="size-[16px]" />
              다시 시도
            </Button>
          )}
          <Button
            variant="outline"
            onPress={() => router.push(homeHref)}
            className="h-[40px] flex-1 rounded-[17px] border-gray-200 bg-white px-[18px] text-[14px] font-medium text-gray-700 data-[hovered=true]:bg-gray-100 sm:flex-none"
          >
            홈으로
          </Button>
        </div>

        {digest && (
          <p className="mt-[24px] text-[12px] text-gray-400">
            오류 코드 {digest}
          </p>
        )}
      </div>
    </div>
  );
}
