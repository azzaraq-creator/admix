"use client";

import { createPortal } from "react-dom";

import { ChevronLeftIcon, XIcon } from "@/components/icons";
import type { ProposalDetail } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

import { AdminSlideView, type AdminSlide } from "./AdminSlideView";

type Props = {
  slides: AdminSlide[];
  index: number;
  onIndexChange: (index: number) => void;
  summaryProposal: ProposalDetail | null;
  updatedAt: string | null;
  onClose: () => void;
};

export function ProposalSlideLightbox({
  slides,
  index,
  onIndexChange,
  summaryProposal,
  updatedAt,
  onClose,
}: Props) {
  const total = slides.length;
  const current = slides[index] ?? slides[0];

  const prev = () => onIndexChange((index - 1 + total) % total);
  const next = () => onIndexChange((index + 1) % total);

  // 조상 stacking context에 갇히지 않도록 body로 portal (ImageLightbox와 동일).
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-50 flex flex-col gap-[16px] bg-black/70 p-[36px]"
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
        <div className="flex min-h-0 flex-1 items-center gap-[52px]">
          <button
            type="button"
            onClick={prev}
            aria-label="이전 슬라이드"
            className="flex size-[48px] shrink-0 items-center justify-center text-white"
          >
            <ChevronLeftIcon className="size-[48px]" />
          </button>
          <div className="flex h-full min-w-0 flex-1 items-center justify-center">
            <div className="relative aspect-[1920/1080] h-full max-w-full overflow-hidden rounded-[4px] bg-white">
              {current && (
                <AdminSlideView
                  slide={current}
                  summaryProposal={summaryProposal}
                  updatedAt={updatedAt}
                />
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="다음 슬라이드"
            className="flex size-[48px] shrink-0 items-center justify-center text-white"
          >
            <ChevronLeftIcon className="size-[48px] rotate-180" />
          </button>
        </div>

        <div className="flex justify-center">
          <div className="rounded-full bg-black/60 px-[16px] py-[6px] text-[18px] font-semibold leading-[28px] tracking-[-0.04px]">
            <span className="text-white">{index + 1} </span>
            <span className="text-[#767676]">/ {total}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-[8px] overflow-x-auto px-[100px]">
        {slides.map((slide, thumbIndex) => (
          <button
            key={thumbIndex}
            type="button"
            onClick={() => onIndexChange(thumbIndex)}
            className={cn(
              "relative aspect-[1920/1080] h-[68px] shrink-0 overflow-hidden rounded-[4px] bg-white transition-opacity",
              thumbIndex === index
                ? "ring-2 ring-white"
                : "opacity-50 hover:opacity-80",
            )}
          >
            <AdminSlideView
              slide={slide}
              summaryProposal={summaryProposal}
              updatedAt={updatedAt}
            />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
