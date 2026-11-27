"use client";

import { Badge, Button, Chip, Drawer, ListBox, Popover } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ExternalTrigger } from "@/components/common/ExternalTrigger";
import { MaskIcon } from "@/components/common/MaskIcon";
import { CloseMediumIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { todosOf } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { usePartnerWorkspace } from "./partnerState";
import { useProvisionalGate } from "./ProvisionalGate";

/*
 * 제휴사 알림 — admix 사이드바의 "현재 기획안" 카드와 같은 자리 · 같은 방식.
 * PC: 사이드바 프로필 위 요약 카드(접히면 종 아이콘 + 숫자), 누르면 오른쪽에 붙는 패널(HeroUI Popover).
 * 모바일: 위 띠 오른쪽 종 아이콘, 누르면 아래에서 올라오는 시트(HeroUI Drawer).
 * 알림 = 고른 매장에서 지금 확인할 일(점검 사진 · 확정 요청 · 새 콜라보 참여 여부 · 새 공지, 서버 — partnerState).
 */

const LABEL = "알림";
/** 종류는 제목 앞 점 색으로만 구분 — 사진(노랑) · 확정 요청(하늘) · 참여 여부(초록, 11-12) · 공지(회색). */
const KIND_DOT = {
  photo: "bg-amber-400",
  confirm: "bg-sky-400",
  answer: "bg-emerald-400",
  notice: "bg-gray-300",
} as const;

/**
 * 종 — public/icons/notification.svg 그대로(MaskIcon, 옆 메뉴 아이콘과 같은 gray-800).
 * 알림이 와도 모양을 바꾸지 않는다(11-27 사용자: "알림 온 거랑 별개로 notification.svg로만") — 예전엔 두 톤 종 + 빨간 점.
 */
function Bell({ className }: { className?: string }) {
  return (
    <MaskIcon
      src="/icons/notification.svg"
      className={cn("shrink-0 text-gray-800", className)}
    />
  );
}

/**
 * 종 + 오른쪽 위 알림 수(HeroUI Badge) — 모바일 위 띠 · PC 사이드바를 접었을 때(11-27 사용자).
 * 색은 PC 사이드바 펼친 상태의 숫자 알약과 같은 red-500, 흰 테두리로 종과 떨어져 보이게.
 */
function BellWithCount({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  return (
    <Badge.Anchor>
      <Bell className={className} />
      {count > 0 && (
        <Badge
          aria-hidden
          color="danger"
          size="sm"
          placement="top-right"
          className="border-surface bg-red-500 px-[3px] font-bold text-white"
        >
          <Badge.Label>{count}</Badge.Label>
        </Badge>
      )}
    </Badge.Anchor>
  );
}

function useNotifications() {
  const { state, today } = usePartnerWorkspace();
  return todosOf(state, today);
}

/** 패널 안 — 제목 · 닫기 · 알림 목록. */
function NotificationContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const gate = useProvisionalGate();
  const items = useNotifications();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-[8px] border-b border-gray-100 py-[12px] pr-[12px] pl-[20px]">
        <p className="flex items-center gap-[6px] text-[16px] font-bold text-gray-900">
          {LABEL}
          {items.length > 0 && (
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-[6px] text-[12px] font-semibold text-gray-600">
              {items.length}
            </span>
          )}
        </p>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="닫기"
          onPress={onClose}
          className="size-[36px] min-w-0 rounded-[15px] text-gray-500"
        >
          <CloseMediumIcon className="size-[24px]" />
        </Button>
      </div>
      {items.length ? (
        <ListBox
          aria-label="알림 목록"
          selectionMode="none"
          onAction={(key) => {
            const item = items.find((t) => t.id === key);
            if (!item) return;
            onClose();
            // 임시 승인이면 상세 대신 안내 창(ProvisionalGate).
            if (gate.block()) return;
            router.push(collabHref(item.collabId, "notifications"));
          }}
          className="min-h-0 flex-1 gap-[2px] overflow-y-auto p-[8px]"
        >
          {items.map((t) => (
            <ListBox.Item
              key={t.id}
              id={t.id}
              textValue={t.title}
              className="group gap-[10px] rounded-[16px] px-[14px] py-[12px] transition-colors data-[hovered=true]:bg-gray-50 data-[pressed=true]:bg-gray-100"
            >
              {/* 점은 제목 줄(14px · 줄 높이 1.4 → 약 20px) 가운데에 맞춘다. */}
              <span
                aria-hidden
                className={cn(
                  "mt-[7px] size-[7px] shrink-0 self-start rounded-full",
                  KIND_DOT[t.kind],
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <span className="truncate text-[14px] leading-[1.4] font-semibold text-gray-900">
                  {t.title}
                </span>
                <span className="flex min-w-0 items-center gap-[6px] text-[12px] leading-[1.4] text-gray-500">
                  {/* 콜라보 이름만 한 단계 진하게(11-27 사용자 "콜라보 이름도 조금 임팩트") — 브랜드 · 설명은 회색 그대로. */}
                  <span className="truncate">
                    {t.brand}
                    {/* 브랜드 · 콜라보 이름 사이 "-"(11-27 사용자 "브랜드명 옆에 - 하나 그어줘"). */}
                    <span aria-hidden className="mx-[5px] text-gray-400">
                      -
                    </span>
                    <b className="font-semibold text-gray-800">
                      {t.collabTitle}
                    </b>
                    {t.detail && ` · ${t.detail}`}
                  </span>
                  {/* 마감 — 날짜만 Chip, 뒤에 "마감"(11-27 사용자). */}
                  {t.due && (
                    <span className="flex shrink-0 items-center gap-[4px]">
                      <Chip
                        size="sm"
                        variant="soft"
                        className="h-[18px] rounded-[6px] px-[6px] text-[11px] font-semibold text-gray-700"
                      >
                        {t.due}
                      </Chip>
                      마감
                    </span>
                  )}
                </span>
              </span>
              <ChevronRight className="size-[16px] shrink-0 text-gray-300 transition-[color,translate] group-data-[hovered=true]:translate-x-[2px] group-data-[hovered=true]:text-gray-500" />
            </ListBox.Item>
          ))}
        </ListBox>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[6px] px-[20px] py-[40px] text-center">
          <span className="mb-[4px] flex size-[48px] items-center justify-center rounded-full bg-gray-100 text-gray-400">
            <MaskIcon src="/icons/notification.svg" className="size-[22px]" />
          </span>
          <b className="text-[14px] text-gray-900">새 알림이 없어요</b>
          <p className="text-[13px] text-gray-500">
            확정 요청 · 점검 사진 · 공지가 오면 여기에 모여요.
          </p>
        </div>
      )}
    </>
  );
}

/**
 * PC 사이드바 — 상자(44px) 안 "알림" 한 줄. 아래 구분선 · 화면 모드 · 프로필과 떨어져 있다.
 * 테두리 없이 옅은 회색 바탕 상자 — 메뉴 줄(바탕 없음)과 구분되고, 마우스를 올리거나 열리면 한 단계 진해진다.
 * 아이콘은 메뉴와 같은 x=39px 열.
 * 접으면 아이콘만 남는다. 누르면 오른쪽 패널.
 */
export function PartnerNotificationCard({ collapsed }: { collapsed: boolean }) {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLButtonElement>(null);
  const count = items.length;
  const ariaLabel = `${LABEL}${count ? ` ${count}개` : ""}`;

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        title={collapsed ? LABEL : undefined}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-[44px] w-full items-center gap-[9px] overflow-hidden rounded-[19px] pr-[12px] pl-[20px] text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
          open ? "bg-gray-100" : "bg-gray-50 hover:bg-gray-100",
        )}
      >
        {/* 접었을 때만 종 오른쪽 위에 알림 수(Badge, 11-27 사용자 "접은 상태에서도 Badge로") — 펼치면 오른쪽 끝 알약. */}
        <BellWithCount
          count={collapsed ? count : 0}
          className="size-[18px]"
        />
        <span
          className={cn(
            "text-sm font-semibold whitespace-nowrap text-gray-900",
            collapsed
              ? "sm:opacity-0 sm:transition-none"
              : "opacity-100 transition-opacity duration-300",
          )}
        >
          {LABEL}
        </span>
        {/* 알림 수 — 오른쪽 끝, 옆 메뉴 "콜라보 참여" 숫자와 같은 크기의 알약(11-27 사용자). 접으면 글자처럼 숨긴다.
            색은 빨강(11-27 사용자 "이것까지 보라색이면 좀 그래. 빨간색 어때?") — 예전 종의 빨간 점과 같은 red-500. */}
        {count > 0 && (
          <span
            aria-hidden
            className={cn(
              "ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-red-500 px-[5px] text-[11px] leading-none font-bold text-white",
              collapsed
                ? "sm:opacity-0 sm:transition-none"
                : "opacity-100 transition-opacity duration-300",
            )}
          >
            {count}
          </span>
        )}
      </button>
      {isDesktop && (
        <Popover isOpen={open} onOpenChange={setOpen}>
          <ExternalTrigger />
          <Popover.Content
            triggerRef={ref}
            placement="right bottom"
            offset={14}
            className="rounded-[20px] border border-tone-ececef bg-surface p-0 shadow-[0px_12px_40px_rgba(0,0,0,0.16)]"
          >
            <Popover.Arrow />
            <Popover.Dialog
              aria-label={LABEL}
              className="flex max-h-[min(560px,calc(100dvh-40px))] w-[380px] flex-col overflow-hidden rounded-[20px] p-0 outline-none"
            >
              <NotificationContent onClose={() => setOpen(false)} />
            </Popover.Dialog>
          </Popover.Content>
        </Popover>
      )}
    </>
  );
}

/** 모바일 위 띠 — 종 아이콘(PC와 같은 notification.svg) + 아래 시트. */
export function PartnerNotificationHeaderButton() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  return (
    <>
      <button
        type="button"
        aria-label={`${LABEL}${items.length ? ` ${items.length}개` : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="ml-auto flex h-full w-[48px] shrink-0 items-center justify-center text-gray-900"
      >
        {/* PC 사이드바 알림과 같은 종(notification.svg) — 11-08 사용자: "모바일 알림 아이콘이 달라". */}
        {/* 알림 수 — 종 오른쪽 위 HeroUI Badge(11-27 사용자 "모바일 종에도 알림 수 띄워줘. Badge로"). */}
        <BellWithCount count={items.length} className="size-[20px]" />
      </button>
      {!isDesktop && (
        <Drawer.Backdrop isOpen={open} onOpenChange={setOpen}>
          <Drawer.Content placement="bottom">
            <Drawer.Dialog
              aria-label={LABEL}
              className="flex max-h-[80dvh] w-full flex-col gap-0 rounded-t-[24px] bg-surface p-0 pt-[10px]"
            >
              <Drawer.Handle />
              <NotificationContent onClose={() => setOpen(false)} />
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      )}
    </>
  );
}
