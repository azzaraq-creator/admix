"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { ChevronDownIcon, RotateCwIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS = [
  "카테고리",
  "가격 범위",
  "매체 판매 유형",
  "매체 타입",
  "설치 장소",
  "매체 형태",
];

type MediaFilterBarProps = {
  filters?: string[];
  className?: string;
};

export function MediaFilterBar({
  filters = DEFAULT_FILTERS,
  className,
}: MediaFilterBarProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el) return;
    drag.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !drag.current.active) return;
    const dx = event.clientX - drag.current.startX;
    if (Math.abs(dx) > 3) drag.current.moved = true;
    el.scrollLeft = drag.current.startScroll - dx;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current.active = false;
    scrollRef.current?.releasePointerCapture(event.pointerId);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (drag.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      drag.current.moved = false;
    }
  };

  if (open) {
    return (
      <div
        className={cn(
          "flex flex-col gap-[16px] border-b border-stroke bg-white pt-[12px] drop-shadow-[0px_4px_2px_rgba(0,0,0,0.16)]",
          className,
        )}
      >
        <div className="flex flex-col gap-[6px] px-[16px] py-[2px]">
          {[0, 2, 4].map((start) => (
            <div key={start} className="flex gap-[6px]">
              {filters.slice(start, start + 2).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className="flex flex-1 items-center justify-center rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
                >
                  {filter}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between bg-[#f6f6f6] px-[16px] py-[12px]">
          <button
            type="button"
            className="flex items-center gap-[4px] rounded-[8px] border border-primary bg-white px-[12px] py-[8px] text-sm font-medium text-primary"
          >
            <RotateCwIcon className="size-[18px] text-primary" />
            초기화
          </button>
          <button
            type="button"
            aria-label="필터 접기"
            onClick={() => setOpen(false)}
            className="flex items-center rounded-full border border-stroke p-[6px] text-black"
          >
            <ChevronDownIcon className="size-[24px] rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-[16px] border-b border-stroke py-[12px]",
        className,
      )}
    >
      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={onClickCapture}
        className="flex flex-1 cursor-grab items-center gap-[6px] overflow-x-auto px-[16px] select-none [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          className="flex shrink-0 items-center gap-[4px] rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
        >
          <RotateCwIcon className="size-[18px] text-primary" />
          초기화
        </button>
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className="shrink-0 whitespace-nowrap rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="pr-[16px]">
        <button
          type="button"
          aria-label="필터 펼치기"
          onClick={() => setOpen(true)}
          className="flex items-center rounded-full border border-stroke p-[6px] text-black"
        >
          <ChevronDownIcon className="size-[24px]" />
        </button>
      </div>
    </div>
  );
}
