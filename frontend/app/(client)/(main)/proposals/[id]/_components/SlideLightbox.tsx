"use client";

import { type ReactNode, useEffect, useRef } from "react";

import { ChevronLeftIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type Slide = { id: string; name: string };

export function SlideLightbox({
  slides,
  index,
  onIndexChange,
  onClose,
  renderSlide,
}: {
  slides: Slide[];
  index: number;
  onIndexChange: (updater: (i: number) => number) => void;
  onClose: () => void;
  renderSlide: (slide: Slide, mapEnabled: boolean) => ReactNode;
}) {
  const activeThumbRef = useRef<HTMLButtonElement>(null);

  // Esc 닫기 / 좌우 화살표로 슬라이드 이동
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft")
        onIndexChange((i) => Math.max(0, i - 1));
      else if (event.key === "ArrowRight")
        onIndexChange((i) => Math.min(slides.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose, onIndexChange]);

  // 하단 스트립: 현재 슬라이드를 보이게 스크롤
  useEffect(() => {
    activeThumbRef.current?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [index]);

  if (!slides[index]) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex flex-col gap-[16px] bg-black/90 p-[36px]"
    >
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex size-[48px] items-center justify-center text-white"
        >
          <XIcon className="size-[32px]" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
        <div className="flex min-h-0 flex-1 items-center gap-[24px]">
          <button
            type="button"
            onClick={() => onIndexChange((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="이전 슬라이드"
            className="flex size-[48px] shrink-0 items-center justify-center text-white disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-[48px]" />
          </button>
          <div className="flex h-full min-w-0 flex-1 items-center justify-center">
            <div
              className="relative aspect-[1920/1080] max-h-full overflow-hidden rounded-[8px] bg-white"
              style={{ width: "min(100%, calc((100vh - 320px) * 16 / 9))" }}
            >
              {renderSlide(slides[index], true)}
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onIndexChange((i) => Math.min(slides.length - 1, i + 1))
            }
            disabled={index === slides.length - 1}
            aria-label="다음 슬라이드"
            className="flex size-[48px] shrink-0 items-center justify-center text-white disabled:opacity-30"
          >
            <ChevronLeftIcon className="size-[48px] rotate-180" />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="rounded-full bg-black/60 px-[16px] py-[6px] text-[18px] font-semibold leading-[28px] tracking-[-0.04px]">
            <span className="text-white">{index + 1} </span>
            <span className="text-[#767676]">/ {slides.length}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-[8px] overflow-x-auto">
        {slides.map((slide, idx) => (
          <button
            key={slide.id}
            ref={idx === index ? activeThumbRef : undefined}
            type="button"
            onClick={() => onIndexChange(() => idx)}
            className={cn(
              "relative aspect-[1920/1080] h-[68px] shrink-0 overflow-hidden rounded-[4px] bg-white transition-opacity",
              idx === index
                ? "ring-2 ring-white"
                : "opacity-50 hover:opacity-80",
            )}
          >
            {renderSlide(slide, false)}
          </button>
        ))}
      </div>
    </div>
  );
}
