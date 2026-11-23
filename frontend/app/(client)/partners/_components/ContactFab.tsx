"use client";

import { Button, Tooltip } from "@heroui/react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { cn } from "@/lib/utils";

/**
 * 오른쪽 아래에 떠 있는 문의 버튼 둘 — 실시간 채팅 · 전화(11-23 사용자: "아직 정해진 건 없어서 그냥 버튼만").
 * 콜라보 소개(/partners)와 하위 안내 페이지(/partners/about/*)에만 둔다.
 * TODO: 채팅 창 · 전화번호가 정해지면 onPress 를 잇는다. 지금은 눌러도 아무 일이 없다.
 * 휴대폰은 아래 탭 바(--partners-tabbar-space)가 있으면 그 위로 올린다. PC는 마우스를 올리면 왼쪽에 이름표(HeroUI Tooltip)가 뜬다.
 */
const ITEMS = [
  {
    key: "chat",
    label: "실시간 채팅",
    icon: "/icons/bubble.svg",
    primary: true,
  },
  { key: "call", label: "전화 문의", icon: "/icons/call.svg", primary: false },
] as const;

export function ContactFab() {
  return (
    <div className="fixed right-[16px] bottom-[calc(16px+var(--partners-tabbar-space,0px))] z-30 flex flex-col gap-[10px] sm:right-[24px] sm:bottom-[24px]">
      {ITEMS.map((item) => (
        // 이름표는 HeroUI Tooltip(11-23 사용자) — Button 을 바로 넣는다(감싼 칸을 두면 Tab 이 두 번 멈춘다). 휴대폰(터치)에선 뜨지 않는다.
        <Tooltip key={item.key} delay={150} closeDelay={0}>
          <Button
            isIconOnly
            aria-label={item.label}
            className={cn(
              "size-[48px] min-w-0 rounded-full shadow-[0_8px_20px_-8px_rgba(22,19,31,0.28)] sm:size-[52px]",
              item.primary
                ? "bg-primary text-white"
                : "bg-surface text-gray-900 ring-1 ring-gray-100 ring-inset",
            )}
          >
            <MaskIcon src={item.icon} className="size-[20px] sm:size-[22px]" />
          </Button>
          <Tooltip.Content showArrow placement="left">
            <Tooltip.Arrow />
            {item.label}
          </Tooltip.Content>
        </Tooltip>
      ))}
    </div>
  );
}
