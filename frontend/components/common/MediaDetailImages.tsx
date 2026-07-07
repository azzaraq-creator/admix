"use client";

import type { ReactNode } from "react";

import { PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type MediaDetailImagesProps = {
  images: string[];
  onOpen: (index: number) => void;
};

function ImageCell({
  src,
  index,
  onOpen,
  className,
  children,
}: {
  src?: string;
  index?: number;
  onOpen?: (index: number) => void;
  className?: string;
  children?: ReactNode;
}) {
  const clickable = src != null && index != null && onOpen != null;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={clickable ? () => onOpen(index) : undefined}
      aria-label="이미지 크게보기"
      className={cn(
        "relative min-w-0 overflow-hidden bg-[#d9d9d9]",
        clickable && "cursor-pointer",
        className,
      )}
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      )}
      {children}
    </button>
  );
}

// 디테일패널 이미지 배치 — 개수에 따라 레이아웃이 달라진다.
// 1장: 전체 폭 / 2장: 좌우 2분할 / 3장 이상: 좌측 큰 이미지 + 우측 세로 2분할.
// 3장 초과면 우측 하단에 "더보기" 오버레이(추가 이미지는 라이트박스로).
export function MediaDetailImages({ images, onOpen }: MediaDetailImagesProps) {
  const count = images.length;

  return (
    <div className="flex h-[200px] w-full items-center justify-center gap-[2px] overflow-hidden bg-white">
      {count <= 1 ? (
        <ImageCell
          src={images[0]}
          index={count === 1 ? 0 : undefined}
          onOpen={onOpen}
          className="h-full flex-1"
        />
      ) : count === 2 ? (
        <>
          <ImageCell src={images[0]} index={0} onOpen={onOpen} className="h-full flex-1" />
          <ImageCell src={images[1]} index={1} onOpen={onOpen} className="h-full flex-1" />
        </>
      ) : (
        <>
          <ImageCell src={images[0]} index={0} onOpen={onOpen} className="h-full flex-1" />
          {/* 우측 컬럼은 정사각형 2개 세로 스택. 높이 200에서 (200-2)/2 = 99px 정사각형. */}
          <div className="flex h-full w-[99px] shrink-0 flex-col gap-[2px]">
            <ImageCell
              src={images[1]}
              index={1}
              onOpen={onOpen}
              className="h-[99px] w-full"
            />
            <ImageCell
              src={images[2]}
              index={2}
              onOpen={onOpen}
              className="h-[99px] w-full"
            >
              {count > 3 && (
                <>
                  <span className="absolute inset-0 bg-black/70" />
                  <span className="absolute left-1/2 top-1/2 flex w-[36px] -translate-x-1/2 -translate-y-1/2 flex-col items-center">
                    <PlusIcon className="size-[20px] text-white" />
                    <span className="text-[14px] font-medium leading-[1.6] tracking-[-0.35px] text-white">
                      더보기
                    </span>
                  </span>
                </>
              )}
            </ImageCell>
          </div>
        </>
      )}
    </div>
  );
}
