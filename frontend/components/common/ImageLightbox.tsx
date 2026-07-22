"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { ChevronLeftIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ImageLightboxProps = {
  images: (string | null | undefined)[];
  initialIndex?: number;
  onClose: () => void;
};

function Placeholder({ src }: { src?: string | null }) {
  if (!src) return <div className="size-full bg-[#d9d9d9]" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-full object-contain" />;
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: ImageLightboxProps) {
  const total = images.length;
  const [index, setIndex] = useState(initialIndex);

  const prev = () => setIndex((i) => (i - 1 + total) % total);
  const next = () => setIndex((i) => (i + 1) % total);

  // 조상 stacking context(예: 드로어 부모의 z-10)에 갇히지 않도록 body로 portal.
  // → 사이드바 등 전체 레이아웃 위에 오버레이가 뜬다.
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
            aria-label="이전 이미지"
            className="flex size-[48px] shrink-0 items-center justify-center text-white"
          >
            <ChevronLeftIcon className="size-[48px]" />
          </button>
          <div className="flex h-full min-w-0 flex-1 items-center justify-center">
            <Placeholder src={images[index]} />
          </div>
          <button
            type="button"
            onClick={next}
            aria-label="다음 이미지"
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

      <div className="flex justify-center gap-[8px] px-[100px]">
        {images.map((src, thumbIndex) => (
          <button
            key={thumbIndex}
            type="button"
            onClick={() => setIndex(thumbIndex)}
            className={cn(
              "h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[4px] transition-opacity",
              thumbIndex === index
                ? "ring-2 ring-white"
                : "opacity-50 hover:opacity-80",
            )}
          >
            <Placeholder src={src} />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
