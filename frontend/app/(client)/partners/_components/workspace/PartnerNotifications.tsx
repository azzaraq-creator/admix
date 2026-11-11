"use client";

import { Button, Drawer, ListBox, Popover } from "@heroui/react";
import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import { CloseMediumIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { todosOf } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { usePartnerWorkspace } from "./partnerState";

/*
 * 제휴사 알림 — admix 사이드바의 "현재 기획안" 카드와 같은 자리 · 같은 방식.
 * PC: 사이드바 프로필 위 요약 카드(접히면 종 아이콘 + 숫자), 누르면 오른쪽에 붙는 패널(HeroUI Popover).
 * 모바일: 위 띠 오른쪽 종 아이콘, 누르면 아래에서 올라오는 시트(HeroUI Drawer).
 * 알림 = 고른 매장에서 지금 확인할 일(점검 사진 · 확정 요청 · 새 공지, 서버 — partnerState).
 */

const LABEL = "알림";
/** 종류는 제목 앞 점 색으로만 구분 — 사진(노랑) · 확정 요청(하늘) · 공지(회색). */
const KIND_DOT = {
  photo: "bg-amber-400",
  confirm: "bg-sky-400",
  notice: "bg-gray-300",
} as const;

/**
 * 종 — notification.svg 모양을 회색 두 톤(몸통 진하게 gray-800 · 추 gray-500)으로 — 옆 메뉴 아이콘과 같은 진하기.
 * 보라 · 노랑은 쓰지 않는다(11-06 사용자: "보라 싫다", "노랑 · 주황은 혼자 화려해"). 옅은 회색은 "칙칙하다"(11-08).
 * badge 면 badge-notification.svg 모양(오른쪽 위가 파인 몸통 + 빨간 점).
 */
function BellTwoTone({
  badge = false,
  className,
}: {
  badge?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 18"
      fill="none"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path
        d="M8 18C9.38503 18 10.5633 17.1652 11 16H5C5.43668 17.1652 6.61497 18 8 18Z"
        className="fill-gray-500"
      />
      <path d={badge ? BELL_BADGE_BODY : BELL_BODY} className="fill-gray-800" />
      {badge && <circle cx="13" cy="3" r="3" className="fill-red-500" />}
    </svg>
  );
}
const BELL_BODY =
  "M2.22281 16H13.7772C15.6056 16 16.6492 14.1609 15.5522 12.8721C15.0666 12.3016 14.7673 11.6249 14.6867 10.9153L14.2395 6.97519C13.9984 4.85063 12.4123 3.10719 10.2699 2.37366V2.26995C10.2699 1.01629 9.25366 0 8 0C6.74634 0 5.73005 1.01629 5.73005 2.26995V2.37366C3.58766 3.10719 2.0016 4.85063 1.76046 6.97519L1.31328 10.9153C1.23274 11.6249 0.933441 12.3016 0.447786 12.8721C-0.649243 14.1609 0.394434 16 2.22281 16Z";
const BELL_BADGE_BODY =
  "M8 0C8.67094 0.000106293 9.272 0.292983 9.6875 0.755859C9.25311 1.39573 9 2.16834 9 3C9 5.20914 10.7908 7 13 7C13.4244 6.99996 13.833 6.93302 14.2168 6.81055C14.2248 6.86521 14.233 6.9204 14.2392 6.97559L14.6865 10.915C14.767 11.6246 15.0661 12.3016 15.5517 12.8721C16.6488 14.1608 15.6047 16 13.7764 16H2.22265C0.394296 16 -0.649702 14.1608 0.447264 12.8721C0.932919 12.3015 1.23196 11.6247 1.3125 10.915L1.75976 6.97559C2.00088 4.85113 3.58724 3.10761 5.72949 2.37402V2.26953C5.72971 1.01607 6.74648 0 8 0Z";

function useNotifications() {
  const { state, today } = usePartnerWorkspace();
  return todosOf(state, today);
}

/** 패널 안 — 제목 · 닫기 · 알림 목록. */
function NotificationContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const items = useNotifications();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-[8px] border-b border-gray-100 py-[12px] pr-[12px] pl-[20px]">
        <p className="flex items-center gap-[6px] text-[16px] font-bold text-gray-900">
          {LABEL}
          {items.length > 0 && (
            <span className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-gray-100 px-[6px] text-[12px] font-semibold text-gray-600 tabular-nums">
              {items.length}
            </span>
          )}
        </p>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="닫기"
          onPress={onClose}
          className="size-[36px] min-w-0 rounded-[14px] text-gray-500"
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
                <span className="truncate text-[12px] leading-[1.4] text-gray-500">
                  {t.detail}
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
          "flex h-[44px] w-full items-center gap-[9px] overflow-hidden rounded-[16px] pr-[12px] pl-[20px] text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-200",
          open ? "bg-gray-100" : "bg-gray-50 hover:bg-gray-100",
        )}
      >
        <BellTwoTone badge={count > 0} className="h-[18px] w-[16px] mx-[1px]" />
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
      </button>
      {isDesktop && (
        <Popover isOpen={open} onOpenChange={setOpen}>
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

/** 모바일 위 띠 — 종 아이콘(PC와 같은 두 톤 종) + 아래 시트. */
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
        {/* PC 사이드바 알림과 같은 종(회색 두 톤 · 알림이 있으면 빨간 점) — 11-08 사용자: "모바일 알림 아이콘이 달라". */}
        <BellTwoTone badge={items.length > 0} className="h-[20px] w-[18px]" />
      </button>
      {!isDesktop && (
        <Drawer isOpen={open} onOpenChange={setOpen}>
          <Drawer.Backdrop>
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
        </Drawer>
      )}
    </>
  );
}
