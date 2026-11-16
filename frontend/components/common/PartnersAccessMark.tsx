"use client";

import { Tooltip } from "@heroui/react";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";

/** 콜라보 매장 카드를 누를 수 있는지 — open: 매장 정보 팝업이 뜬다, locked: 보이기만 하고 눌리지 않는다. */
export type PartnersCardAccess = "open" | "locked";

const LOCKED_HINT = "광고주 회원만 열 수 있어요.";

/**
 * 콜라보 매장 카드의 "기획안 담기" 자리(콜라보엔 담기가 없다)에 놓는 표시 — 매체 찾기 목록 카드·지도 말풍선.
 * locked 만 자물쇠를 단다. open 은 매체 카드처럼 누르면 정보 팝업이 떠서 따로 표시하지 않는다
 * (예전엔 매장 상세가 새 탭으로 열려 새 탭 아이콘 · "새 탭으로 열립니다."를 달았다 — 11-16 팝업으로 바꾸며 뺐다).
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
  if (access === "open") return null;
  return (
    <Tooltip isOpen={hovered} delay={0} closeDelay={0}>
      <Tooltip.Trigger
        role="img"
        tabIndex={-1}
        aria-label={LOCKED_HINT}
        className={cn(
          "flex shrink-0 items-center justify-center text-gray-400",
          className,
        )}
      >
        <Lock aria-hidden className="size-[14px] shrink-0" />
      </Tooltip.Trigger>
      <Tooltip.Content placement={placement} className="whitespace-nowrap">
        {LOCKED_HINT}
      </Tooltip.Content>
    </Tooltip>
  );
}
