"use client";

import { Tooltip } from "@heroui/react";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 콜라보 매장 카드를 누를 수 있는지 — open: 매장 정보 팝업이 뜬다, locked: 보이기만 하고 눌리지 않는다(광고주가 아님),
 * unverified: 사업자등록증 승인 전 광고주 — locked 처럼 눌리지 않고, 금액 · 가능 범위를 흐리게 가리고 관심(하트)도 막는다(11-17 사용자).
 */
export type PartnersCardAccess = "open" | "locked" | "unverified";

/** 카드를 열 수 없는지(locked · unverified). */
export const isCardLocked = (access: PartnersCardAccess | undefined) =>
  access === "locked" || access === "unverified";

const LOCKED_HINT: Record<Exclude<PartnersCardAccess, "open">, string> = {
  locked: "광고주 회원만 열 수 있어요.",
  unverified: "사업자등록증 승인을 받으면 볼 수 있어요.",
};

/**
 * 승인 전 광고주에게 값 대신 흐린 자리 — 진짜 값은 그리지 않고 예시 글을 흐리게 깐다(11-17 사용자: "카드에 금액과 가능 범위를 블러처리").
 * 화면 읽기 프로그램에는 예시 대신 "승인을 받으면 볼 수 있어요"를 읽힌다.
 */
export function Concealed({
  children,
  strong = false,
  className,
}: {
  children: ReactNode;
  /** 더 세게(6px) — 콜라보 금액(11-17 사용자: "조금도 예측할 수 없게 블러값 더 높여줘" → "6px로 해봐"). 가능 범위는 기본(4px). */
  strong?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0", className)}>
      <span
        aria-hidden
        // 흐림 4px — 처음 5px는 "너무 심하게 들어간 것 같다"(11-17 사용자) → 살짝만 내림. 3px는 예시 금액(1,500,000원)이
        // 읽혀서 진짜 금액처럼 보일 수 있어 4px. 금액은 그 뒤 "조금도 예측할 수 없게" 해 달라고 해서 strong(6px, 사용자 지정).
        className={cn(
          "pointer-events-none flex min-w-0 items-center gap-[5px] select-none",
          strong ? "blur-[6px]" : "blur-[4px]",
        )}
      >
        {children}
      </span>
      <span className="sr-only">사업자등록증 승인을 받으면 볼 수 있어요.</span>
    </span>
  );
}

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
        aria-label={LOCKED_HINT[access]}
        className={cn(
          "flex shrink-0 items-center justify-center text-gray-400",
          className,
        )}
      >
        <Lock aria-hidden className="size-[14px] shrink-0" />
      </Tooltip.Trigger>
      <Tooltip.Content placement={placement} className="whitespace-nowrap">
        {LOCKED_HINT[access]}
      </Tooltip.Content>
    </Tooltip>
  );
}
