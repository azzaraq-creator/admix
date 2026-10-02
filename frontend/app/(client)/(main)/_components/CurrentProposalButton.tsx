"use client";

import { Popover, Spinner } from "@heroui/react";
import { type RefObject, useRef } from "react";

import { BagIcon, ChevronRightIcon } from "@/components/icons";
import {
  hideProposalCallout,
  setCurrentProposalPanelOpen,
  useCurrentProposal,
  useCurrentProposalPanelOpen,
  useProposalCallout,
} from "@/hooks/proposals";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import {
  CURRENT_PROPOSAL_LABEL,
  CurrentProposalPopover,
} from "./CurrentProposalPanel";

/**
 * 담기 알림 말풍선 — 버튼을 화살표로 가리키며 "OOO 제안서에 담았습니다" + 매체명을 잠깐 보여 준다.
 * 화면을 막지 않고(isNonModal) 포커스도 가져가지 않는다. 누르면 패널을 연다.
 */
function ProposalCallout({
  triggerRef,
  placement,
}: {
  triggerRef: RefObject<HTMLButtonElement | null>;
  placement: "right" | "bottom end";
}) {
  const callout = useProposalCallout();
  return (
    <Popover
      isOpen={!!callout}
      onOpenChange={(next) => {
        if (!next) hideProposalCallout();
      }}
    >
      <Popover.Content
        triggerRef={triggerRef}
        isNonModal
        placement={placement}
        offset={12}
        // 앱 토스트(globals.css .toast-region .toast)와 같은 어두운 모양 — 반투명 검정·흐림·흰 글씨.
        // 화살표도 같은 색으로 칠한다.
        className="max-w-[min(320px,calc(100vw-24px))] rounded-[20px] border-0 bg-black/75 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.35)] backdrop-blur-[8px] [&_[data-slot=popover-overlay-arrow]]:fill-black/75"
      >
        <Popover.Arrow />
        {callout && (
          <button
            key={callout.key}
            type="button"
            onClick={() => {
              hideProposalCallout();
              setCurrentProposalPanelOpen(true);
            }}
            className="flex w-full items-start gap-[8px] px-[16px] py-[12px] text-left outline-none"
          >
            {/* 아이콘은 토스트 성공 색(밝은 초록)과 같다. */}
            <BagIcon className="mt-[2px] size-[16px] shrink-0 text-[#4ade80]" />
            <span className="flex min-w-0 flex-col gap-[2px]">
              <span className="text-[14px] font-medium break-keep text-white">
                {callout.title}
              </span>
              {callout.detail && (
                <span className="truncate text-[13px] text-white/70">
                  {callout.detail}
                </span>
              )}
            </span>
          </button>
        )}
      </Popover.Content>
    </Popover>
  );
}

/** 담긴 매체 수 배지. 0개면 숨긴다. corner: 아이콘 오른쪽 위에 걸친다(모바일 헤더·접힌 사이드바). */
function CountBadge({
  count,
  corner = false,
  className,
}: {
  count: number;
  corner?: boolean;
  className?: string;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-[5px] text-[10px] leading-none font-bold text-white tabular-nums",
        corner &&
          "absolute -top-[7px] -right-[9px] h-[16px] min-w-[16px] px-[4px] ring-2 ring-white",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const won = (value: number) => `${value.toLocaleString()}원`;

/**
 * "담는 제안서"(매체를 담으면 들어가는 제안서) 패널을 여는 버튼.
 * - sidebar: PC 사이드바 로그인 정보 위의 요약 카드 — 제안서명·매체 수·총 광고비가 보여 열지 않아도
 *   지금 상태를 안다. 사이드바가 접히면 아이콘 + 배지만 남는다.
 * - header: 모바일 헤더 오른쪽 아이콘 버튼.
 * 아이콘은 사이드바 "제안서" 메뉴와 겹치지 않게 쇼핑백(BagIcon).
 */
export function CurrentProposalButton({
  variant,
  collapsed = false,
}: {
  variant: "sidebar" | "header";
  /** 사이드바가 접혔는지 — 접히면 카드 대신 아이콘 + 배지만 보인다. */
  collapsed?: boolean;
}) {
  const { current, isLoading } = useCurrentProposal();
  const open = useCurrentProposalPanelOpen();
  const isDesktop = useIsDesktop();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const count = current?.media_count ?? 0;
  const ariaLabel = `${CURRENT_PROPOSAL_LABEL}${
    current ? ` ${current.title}` : ""
  }${count > 0 ? ` (매체 ${count}개)` : ""}`;

  if (variant === "header") {
    return (
      <>
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => {
            hideProposalCallout();
            setCurrentProposalPanelOpen(true);
          }}
          className="flex h-full w-[48px] shrink-0 items-center justify-center text-black-900"
        >
          <span className="relative">
            <BagIcon className="size-[20px]" />
            <CountBadge count={count} corner />
          </span>
        </button>
        {!isDesktop && (
          <ProposalCallout triggerRef={buttonRef} placement="bottom end" />
        )}
      </>
    );
  }

  // 열면 말풍선은 닫는다. 열린 채 다시 누르면 닫힌다(바깥 클릭으로 닫힌 직후라 open이 아직 true).
  const toggle = () => {
    hideProposalCallout();
    setCurrentProposalPanelOpen(!open);
  };

  return (
    <>
      {collapsed ? (
        // 접힌 사이드바(안쪽 폭 58px) — 아이콘 가운데가 메뉴 아이콘 열(x=39px)에 온다.
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          title={CURRENT_PROPOSAL_LABEL}
          onClick={toggle}
          className={cn(
            "flex h-[44px] w-full items-center justify-center rounded-[16px] border bg-white text-primary transition-colors",
            open
              ? "border-primary-300 bg-primary-50"
              : "border-black-200 hover:border-primary-200 hover:bg-primary-50/60",
          )}
        >
          <span className="relative">
            <BagIcon className="size-[18px]" />
            <CountBadge count={count} corner />
          </span>
        </button>
      ) : (
        // 요약 카드(곡률 16px) — 이름표·제안서명·매체 수·총 광고비. 메뉴 줄과 달리 테두리 있는 카드.
        <button
          ref={buttonRef}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            "flex w-full flex-col gap-[6px] rounded-[16px] border bg-white p-[12px] text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors",
            open
              ? "border-primary-300 bg-primary-50"
              : "border-black-200 hover:border-primary-200 hover:bg-primary-50/60",
          )}
        >
          <span className="flex items-center gap-[5px] text-[11px] font-semibold text-primary">
            <BagIcon className="size-[13px] shrink-0" />
            {CURRENT_PROPOSAL_LABEL}
            <ChevronRightIcon className="ml-auto size-[14px] shrink-0 text-black-400" />
          </span>
          {isLoading ? (
            // 제안서 목록 불러오는 중 — "매체를 담으면…"이 잠깐 보였다 바뀌지 않게.
            <span
              role="status"
              aria-label="불러오는 중"
              className="flex h-[40px] items-center"
            >
              <Spinner size="sm" />
            </span>
          ) : current ? (
            <>
              <span className="truncate text-[14px] font-bold text-black-900">
                {current.title}
              </span>
              <span className="flex items-center justify-between gap-[6px] whitespace-nowrap">
                <span className="text-[12px] text-black-500">
                  매체 {count}개
                </span>
                <span className="truncate text-[13px] font-bold text-black-900">
                  {won(current.advertisement_amount ?? current.total_amount)}
                </span>
              </span>
            </>
          ) : (
            <span className="text-[12px] leading-[1.5] break-keep text-black-500">
              매체를 담으면 여기에 모여요
            </span>
          )}
        </button>
      )}
      {isDesktop && (
        <>
          <ProposalCallout triggerRef={buttonRef} placement="right" />
          {/* PC 패널 — 이 버튼 오른쪽에 붙어 위로 펼쳐진다. */}
          <CurrentProposalPopover triggerRef={buttonRef} />
        </>
      )}
    </>
  );
}
