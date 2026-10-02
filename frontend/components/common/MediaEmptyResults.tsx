import { Button, EmptyState } from "@heroui/react";

import { Logo, RotateLeftIcon, SearchIcon } from "@/components/icons";

// 필터/검색 결과가 없을 때의 빈 상태. fixed 매체검색 패널 · moving 리스트/상세 공용.
// iconOnly=true 면 로고만(moving 상세 패널). 기본은 관심 매체·내 제안서의 빈 상태와 같은
// 모양(HeroUI EmptyState) — 아이콘 칸 + 제목 + 안내 + (되돌릴 조건이 있으면) 초기화 버튼.
export function MediaEmptyResults({
  iconOnly = false,
  description = "검색어나 필터를 바꿔 다시 찾아보세요.",
  onReset,
}: {
  iconOnly?: boolean;
  description?: string;
  /** 있으면 "검색 조건 초기화" 버튼을 보여 준다(걸린 조건이 없으면 넘기지 않는다). */
  onReset?: () => void;
}) {
  if (iconOnly) {
    return (
      <div className="flex h-full items-center justify-center">
        <Logo className="size-[42px] grayscale opacity-40" />
      </div>
    );
  }

  return (
    <EmptyState className="flex h-full min-h-[240px] flex-1 flex-col items-center justify-center gap-[8px] rounded-2xl border border-[#ececef] bg-white p-[24px] text-center max-sm:min-h-[200px] max-sm:p-[20px]">
      {/* 아이콘 칸 56px → 곡률 25px. 브랜드 연보라 바탕에 돋보기. */}
      <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[25px] bg-primary-50 text-primary max-sm:size-[48px] max-sm:rounded-[21px]">
        <SearchIcon className="size-[24px] max-sm:size-[20px]" />
      </span>
      <p className="text-[16px] font-semibold text-black-900 max-sm:text-[14px]">
        조건에 맞는 매체가 없어요
      </p>
      <p className="text-[13px] leading-[1.6] break-keep text-[#8c8c94] max-sm:text-[12px]">
        {description}
      </p>
      {onReset && (
        <Button
          variant="outline"
          onPress={onReset}
          className="mt-[8px] gap-[6px] rounded-[17px] text-[13px] font-semibold md:rounded-[15px] max-sm:text-[12px]"
        >
          <RotateLeftIcon className="size-[16px]" />
          검색 조건 초기화
        </Button>
      )}
    </EmptyState>
  );
}
