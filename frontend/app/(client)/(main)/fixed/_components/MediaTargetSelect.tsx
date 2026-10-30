"use client";

import { Button, Popover } from "@heroui/react";
import { useState } from "react";

import { SmallCheckIcon, TargetIcon } from "@/components/icons";
import type { PopTarget } from "@/hooks/popGrid";
import { popTargetText } from "@/lib/popGrid/targetText";
import { cn } from "@/lib/utils";

/**
 * 매체 찾기 "타깃" 버튼 — 누르면 아래로 타깃 목록이 열리고(필터처럼) 하나를 고른다.
 * 고른 타깃을 다시 누르면 풀린다. 고르면 버튼 이름이 그 타깃으로 바뀐다.
 * 고른 것(value)은 따로 들고 있지 않고 지금 인구 분포 조건이 타깃과 같은지로 정한다(MediaFindPanel) —
 * 유동인구 창에서 조건을 바꾸면 저절로 풀린다. 목록은 어드민 "타깃 관리"에서 만든다.
 */
export function MediaTargetSelect({
  targets,
  value,
  onChange,
  className,
}: {
  targets: PopTarget[];
  value: number | null;
  onChange: (next: PopTarget | null) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = targets.find((t) => t.id === value);

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      {/* 보라 채움·흰 글자 — 회색 필터·진회색 지도 버튼 사이에서 가장 눈에 띄게 한다. */}
      <Button
        variant="ghost"
        aria-expanded={open}
        className={cn(
          "flex h-[45px] shrink-0 items-center gap-[6px] rounded-[20px] bg-primary px-[20px] text-white shadow-[0px_2px_8px_rgba(122,63,224,0.35)] transition-colors hover:bg-primary-600 active:bg-primary-600 data-[pressed=true]:bg-primary-600 max-sm:h-[40px] max-sm:gap-[4px] max-sm:rounded-[17px] max-sm:px-[14px]",
          open && "bg-primary-600",
          className,
        )}
      >
        <TargetIcon className="m-0 size-[20px] shrink-0 text-white max-sm:size-[17px]" />
        <span className="text-[14px] max-sm:text-[12px] font-semibold whitespace-nowrap text-white">
          {selected?.label ?? "타깃"}
        </span>
      </Button>
      <Popover.Content
        // 꼬리(Popover.Arrow)가 버튼 가운데를 가리킨다 — 꼬리 높이만큼 더 띄운다.
        placement="bottom"
        offset={12}
        className="rounded-[16px] border border-gray-200 bg-surface p-0 shadow-[0px_4px_16px_rgba(0,0,0,0.12)]"
      >
        <Popover.Arrow />
        <Popover.Dialog
          aria-label="타깃 고르기"
          className="flex w-[260px] flex-col gap-[4px] p-[8px] outline-none"
        >
          <div className="px-[8px] pt-[4px] pb-[4px] text-[12px] max-sm:text-[11px] font-medium text-gray-500">
            타깃
          </div>
          {targets.map((t) => {
            const isOn = t.id === value;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={isOn}
                onClick={() => {
                  onChange(isOn ? null : t);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-[10px] rounded-[12px] px-[12px] py-[10px] text-left transition-colors hover:bg-gray-100",
                  isOn && "bg-primary-50 hover:bg-primary-100",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                  <span
                    className={cn(
                      "text-[14px] max-sm:text-[13px] font-medium text-black",
                      isOn && "text-primary",
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="text-[12px] max-sm:text-[11px] text-gray-500">
                    {popTargetText(t)}
                  </span>
                </span>
                {isOn && (
                  <SmallCheckIcon className="size-[18px] shrink-0 text-primary" />
                )}
              </button>
            );
          })}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
