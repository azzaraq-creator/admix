import { Chip } from "@heroui/react";

import { FlameIcon, NewStarIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type MediaBadge = "popular" | "new";

// 인기: 옅은 빨강 바탕 + 빨강, 신규: 옅은 파랑 바탕 + 파랑 — 서비스 전체에서 같은 색을 쓴다.
const TONE: Record<
  MediaBadge,
  { label: string; className: string; Icon: typeof FlameIcon }
> = {
  popular: {
    label: "인기",
    className: "bg-[#fff1f0] text-[#f04438]",
    Icon: FlameIcon,
  },
  new: {
    label: "신규",
    className: "bg-[#eff6ff] text-[#2e90fa]",
    Icon: NewStarIcon,
  },
};

// 크기 — sm: 목록 카드(매체명 앞, "이동" 칩과 같은 높이), md: 매체 정보 팝업·사진 위, lg: 매체 상세 페이지.
const SIZE = {
  sm: {
    chip: "h-[18px] gap-[2px] rounded-[6px] px-[5px] text-[11px] leading-[16px] max-sm:text-[10px]",
    icon: "size-[11px]",
  },
  md: {
    chip: "h-[24px] gap-[3px] rounded-[9px] px-[8px] text-[12px] leading-[16px]",
    icon: "size-[13px]",
  },
  lg: {
    chip: "h-[30px] gap-[4px] rounded-[12px] px-[11px] text-[14px] leading-[20px]",
    icon: "size-[15px]",
  },
} as const;

/** 인기·신규 매체 표시 — 백엔드 badge("popular"/"new") 값을 그대로 받는다. */
export function MediaBadgeChip({
  badge,
  size = "sm",
  className,
}: {
  badge: MediaBadge;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const { label, className: tone, Icon } = TONE[badge];
  return (
    <Chip
      aria-label={`${label} 매체`}
      className={cn(
        "inline-flex w-fit shrink-0 items-center py-0 font-bold",
        SIZE[size].chip,
        tone,
        className,
      )}
    >
      <Icon className={cn("shrink-0", SIZE[size].icon)} aria-hidden />
      {label}
    </Chip>
  );
}
