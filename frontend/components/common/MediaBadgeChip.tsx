"use client";

import { Chip, Popover, Tooltip } from "@heroui/react";

import { FlameIcon, NewStarIcon } from "@/components/icons";
import { useCanHover } from "@/hooks/useCanHover";
import { cn } from "@/lib/utils";

export type MediaBadge = "popular" | "new";

// 인기: 옅은 빨강 바탕 + 빨강, 신규: 옅은 파랑 바탕 + 파랑 — 서비스 전체에서 같은 색을 쓴다.
const TONE: Record<
  MediaBadge,
  { label: string; className: string; Icon: typeof FlameIcon; help: string }
> = {
  popular: {
    label: "인기",
    className: "bg-[#fff1f0] text-[#f04438]",
    Icon: FlameIcon,
    // 기준은 백엔드 popularity.py(최근 90일, 상위 5%)와 맞춘다.
    help: "최근 90일 동안 기획안 담기·제출, 관심 매체 저장이 많은 상위 5% 매체예요.",
  },
  new: {
    label: "신규",
    className: "bg-[#eff6ff] text-[#2e90fa]",
    Icon: NewStarIcon,
    // 기준은 백엔드 media_service.NEW_BADGE_DAYS(14일)와 맞춘다.
    help: "등록된 지 2주(14일) 이내인 새 매체예요.",
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

/**
 * 인기·신규 매체 표시 — 백엔드 badge("popular"/"new") 값을 그대로 받는다.
 * explain: 기준 설명을 붙인다(매체 상세) — 마우스가 있으면 올려서 Tooltip, 터치 기기(모바일·태블릿)는 눌러서 Popover.
 * 화면 폭이 아니라 입력 방식으로 나눈다 — 태블릿은 폭이 PC만큼 넓어도 Tooltip이 터치로 열리지 않는다.
 */
export function MediaBadgeChip({
  badge,
  size = "sm",
  className,
  explain = false,
}: {
  badge: MediaBadge;
  size?: keyof typeof SIZE;
  className?: string;
  explain?: boolean;
}) {
  if (!explain) {
    return <BadgeChip badge={badge} size={size} className={className} />;
  }
  return (
    <ExplainedChip badge={badge} className={className}>
      <BadgeChip badge={badge} size={size} />
    </ExplainedChip>
  );
}

function ExplainedChip({
  badge,
  className,
  children,
}: {
  badge: MediaBadge;
  className?: string;
  children: React.ReactNode;
}) {
  const canHover = useCanHover();
  const { label, help } = TONE[badge];
  const trigger = cn(
    "inline-flex w-fit shrink-0 cursor-pointer outline-none",
    className,
  );
  if (canHover) {
    return (
      <Tooltip delay={200} closeDelay={0}>
        <Tooltip.Trigger className={trigger} aria-label={`${label} 매체 기준`}>
          {children}
        </Tooltip.Trigger>
        <Tooltip.Content placement="bottom start" className="max-w-[260px]">
          <p className="text-[13px] leading-[18px]">{help}</p>
        </Tooltip.Content>
      </Tooltip>
    );
  }
  return (
    <Popover>
      <Popover.Trigger
        className={trigger}
        aria-label={`${label} 매체 기준 보기`}
      >
        {children}
      </Popover.Trigger>
      <Popover.Content placement="bottom start" className="max-w-[260px]">
        <Popover.Dialog>
          <Popover.Heading className="text-[14px] font-bold">
            {label} 매체
          </Popover.Heading>
          <p className="mt-[4px] text-[13px] leading-[18px] text-gray-600">
            {help}
          </p>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}

function BadgeChip({
  badge,
  size,
  className,
}: {
  badge: MediaBadge;
  size: keyof typeof SIZE;
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
