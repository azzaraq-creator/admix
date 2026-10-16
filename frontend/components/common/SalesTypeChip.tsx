import { Chip } from "@heroui/react";

import { cn } from "@/lib/utils";

/**
 * 판매 형태(단품·묶음) 칩 — 매체 찾기 카드·매체 정보 팝업. 둘 다 같은 모양(흰 바탕 + 회색 테두리)에 글자만 다르다.
 * 인기·신규 뱃지(MediaBadgeChip, 옅은 색 바탕)와 헷갈리지 않게 색 바탕을 쓰지 않는다.
 * 정렬·shrink-0·가로 패딩(8px)은 HeroUI Chip 기본값이라 색·모서리·세로 여백만 준다.
 */
export function SalesTypeChip({
  salesType,
  className,
}: {
  salesType: string;
  className?: string;
}) {
  return (
    <Chip
      className={cn(
        "border border-[#e4e4e7] bg-white px-[7px] py-[2px] leading-[18px] font-normal text-[#52525b]",
        className,
      )}
    >
      {salesType}
    </Chip>
  );
}
