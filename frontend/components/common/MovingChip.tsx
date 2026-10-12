import { Chip } from "@heroui/react";

import { BusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * 이동 매체 표시 — 인기·신규(MediaBadgeChip, 옅은 색 바탕)와 헷갈리지 않게 흰 바탕 + 회색 테두리 + 버스 아이콘.
 * 매체 찾기 카드·매체 정보 팝업에서 운행 지역 앞에 붙는다.
 */
export function MovingChip({ className }: { className?: string }) {
  return (
    <Chip
      aria-label="이동 매체"
      className={cn(
        "inline-flex h-[18px] w-fit shrink-0 items-center gap-[3px] rounded-[6px] border border-gray-300 bg-white px-[5px] py-0 text-[11px] leading-[16px] font-semibold text-gray-700 max-sm:text-[10px]",
        className,
      )}
    >
      <BusIcon className="h-[9px] w-[12px] shrink-0" aria-hidden />
      이동
    </Chip>
  );
}
