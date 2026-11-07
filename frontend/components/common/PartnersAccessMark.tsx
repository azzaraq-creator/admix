"use client";

import { Tooltip } from "@heroui/react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/** 콜라보 매장 카드를 누를 수 있는지 — open: 매장 상세가 새 탭으로, locked: 보이기만 하고 눌리지 않는다. */
export type PartnersCardAccess = "open" | "locked";

const HINT: Record<PartnersCardAccess, string> = {
  open: "새 탭으로 열립니다.",
  locked: "광고주 · 제휴사(콜라보) 회원만 열 수 있어요.",
};

/**
 * 콜라보 매장 카드의 "기획안 담기" 자리(콜라보엔 담기가 없다)에 놓는 표시 — 매체 찾기 목록 카드·지도 말풍선.
 * open: 새 탭 아이콘(public/icons/export.svg 를 글자색으로), locked: 자물쇠.
 * 툴팁은 아이콘이 아니라 카드에 마우스를 올리면(hovered) 뜬다 — 카드 쪽에서 hover 상태를 넘긴다.
 * 표시는 누르는 버튼이 아니다(카드 전체가 눌린다) — 툴팁 트리거가 키보드 초점·버튼 역할을 갖지 않게 한다.
 */
export function PartnersAccessMark({
  access,
  hovered,
  placement = "top",
  className,
}: {
  access: PartnersCardAccess;
  hovered: boolean;
  placement?: "top" | "bottom" | "left" | "right";
  /** 바깥 칩 모양(크기·바탕·모서리) — 놓이는 자리의 옆 버튼과 맞춘다. */
  className?: string;
}) {
  const hint = HINT[access];
  return (
    <Tooltip isOpen={hovered} delay={0} closeDelay={0}>
      <Tooltip.Trigger
        role="img"
        tabIndex={-1}
        aria-label={hint}
        className={cn(
          "flex shrink-0 items-center justify-center",
          access === "open" ? "text-gray-600" : "text-gray-400",
          className,
        )}
      >
        {access === "open" ? (
          <span
            aria-hidden
            className="size-[14px] shrink-0 bg-current [mask:url(/icons/export.svg)_center/contain_no-repeat]"
          />
        ) : (
          <Lock aria-hidden className="size-[14px] shrink-0" />
        )}
      </Tooltip.Trigger>
      <Tooltip.Content placement={placement} className="whitespace-nowrap">
        {hint}
      </Tooltip.Content>
    </Tooltip>
  );
}
