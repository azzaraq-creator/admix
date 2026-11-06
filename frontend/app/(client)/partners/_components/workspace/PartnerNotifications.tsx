"use client";

import { Button, Drawer, ListBox, Popover } from "@heroui/react";
import { Bell, Camera, ChevronRight, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ChevronRightIcon, CloseMediumIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { todosOf } from "@/lib/partnersPreview";
import { cn } from "@/lib/utils";

import { collabHref } from "./CollabBoard";
import { usePreviewState } from "./previewStore";

/*
 * 제휴사 알림 — admix 사이드바의 "현재 기획안" 카드와 같은 자리 · 같은 방식.
 * PC: 사이드바 프로필 위 요약 카드(접히면 종 아이콘 + 숫자), 누르면 오른쪽에 붙는 패널(HeroUI Popover).
 * 모바일: 위 띠 오른쪽 종 아이콘, 누르면 아래에서 올라오는 시트(HeroUI Drawer).
 * 알림 = 지금 확인할 일(점검 사진 · 확정 요청 · 새 공지, 지금은 예시 데이터).
 */

const LABEL = "알림";
const KIND_ICON = { photo: Camera, confirm: Inbox, notice: Bell } as const;
const KIND_TONE = {
  photo: "bg-amber-50 text-amber-700",
  confirm: "bg-blue-50 text-blue-600",
  notice: "bg-primary-50 text-primary-600",
} as const;

function useNotifications() {
  return todosOf(usePreviewState());
}

function CountBadge({
  count,
  corner = false,
}: {
  count: number;
  corner?: boolean;
}) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary px-[5px] text-[10px] leading-none font-bold text-white tabular-nums",
        corner &&
          "absolute -top-[7px] -right-[9px] h-[16px] min-w-[16px] px-[4px] ring-2 ring-white",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** 패널 안 — 제목 · 닫기 · 알림 목록. */
function NotificationContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const items = useNotifications();
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-[8px] px-[20px] pt-[18px] pb-[12px]">
        <p className="flex items-center gap-[6px] text-[16px] font-semibold text-black">
          <Bell className="size-[18px] text-gray-900" />
          {LABEL}
          {items.length > 0 && (
            <span className="text-primary tabular-nums">{items.length}</span>
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
            router.push(collabHref(item.collabId));
          }}
          className="min-h-0 flex-1 gap-[8px] overflow-y-auto px-[16px] pb-[16px]"
        >
          {items.map((t) => {
            const Icon = KIND_ICON[t.kind];
            return (
              <ListBox.Item
                key={t.id}
                id={t.id}
                textValue={t.title}
                className="gap-[12px] rounded-[18px] border border-gray-100 bg-gray-50 px-[14px] py-[12px] data-[hovered=true]:border-gray-200 data-[hovered=true]:bg-gray-100"
              >
                <span
                  className={cn(
                    "flex size-[38px] shrink-0 items-center justify-center rounded-[13px]",
                    KIND_TONE[t.kind],
                  )}
                >
                  <Icon className="size-[19px]" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="text-[14px] text-gray-900">{t.title}</b>
                  <small className="truncate text-[12px] text-gray-500">
                    {t.detail}
                  </small>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-gray-400" />
              </ListBox.Item>
            );
          })}
        </ListBox>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-[6px] px-[20px] py-[40px] text-center">
          <Bell className="size-[26px] text-gray-300" />
          <b className="text-[14px] text-gray-900">새 알림이 없어요</b>
          <p className="text-[13px] text-gray-500">
            확정 요청 · 점검 사진 · 공지가 오면 여기에 모여요.
          </p>
        </div>
      )}
    </>
  );
}

/** PC 사이드바 — 요약 카드(접히면 아이콘 + 숫자) + 오른쪽 패널. */
export function PartnerNotificationCard({ collapsed }: { collapsed: boolean }) {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const ref = useRef<HTMLButtonElement>(null);
  const count = items.length;
  const ariaLabel = `${LABEL}${count ? ` ${count}개` : ""}`;
  const tone = open
    ? "border-primary-300 bg-primary-50"
    : "border-gray-200 hover:border-primary-200 hover:bg-primary-50/60";

  return (
    <>
      {collapsed ? (
        <button
          ref={ref}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          title={LABEL}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex h-[44px] w-full items-center justify-center rounded-[16px] border bg-surface text-primary transition-colors",
            tone,
          )}
        >
          <span className="relative">
            <Bell className="size-[18px]" />
            <CountBadge count={count} corner />
          </span>
        </button>
      ) : (
        <button
          ref={ref}
          type="button"
          aria-label={ariaLabel}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={cn(
            "flex w-full overflow-hidden rounded-[16px] border bg-surface p-[12px] text-left shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition-colors",
            tone,
          )}
        >
          <span className="flex w-[134px] shrink-0 animate-[admix-fade-in_300ms_ease-in-out] flex-col gap-[6px] motion-reduce:animate-none">
            <span className="flex items-center gap-[5px] text-[11px] font-semibold text-primary">
              <Bell className="size-[13px] shrink-0" />
              {LABEL}
              <CountBadge count={count} />
              <ChevronRightIcon className="ml-auto size-[14px] shrink-0 text-gray-400" />
            </span>
            {count ? (
              <>
                <span className="truncate text-[14px] font-bold text-gray-900">
                  {items[0].title}
                </span>
                <span className="truncate text-[12px] text-gray-500">
                  {count > 1 ? `외 ${count - 1}개` : items[0].detail}
                </span>
              </>
            ) : (
              <span className="text-[12px] leading-[1.5] break-keep text-gray-500">
                새 알림이 오면 여기에 모여요
              </span>
            )}
          </span>
        </button>
      )}
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

/** 모바일 위 띠 — 종 아이콘 + 아래 시트. */
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
        <span className="relative">
          <Bell className="size-[20px]" />
          <CountBadge count={items.length} corner />
        </span>
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
