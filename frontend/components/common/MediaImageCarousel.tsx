"use client";

import { Button } from "@heroui/react";
import { useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import { Logo } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * 매체 이미지 넘기기 — 매체 찾기 카드와 지도 팝업이 함께 쓴다.
 * 마우스/터치로 끌면 손가락을 따라 움직이고, 떼면 넘긴 거리에 따라 앞/뒤 장으로 스냅한다.
 * 이미지를 끌고 나서 손을 뗄 때 나는 클릭은 부모(카드 선택)로 번지지 않게 막는다.
 * children은 이미지 위에 겹쳐 그릴 버튼들(담기·찜 등)이다.
 * onSlideClick 을 주면 사진을 눌렀을 때(끌기·겹친 버튼 누르기는 빼고) 지금 보이는 장 번호로 부른다 — 매체 상세의 크게 보기.
 */
export function MediaImageCarousel({
  slides,
  sizes,
  className,
  logoClassName = "size-[40px]",
  imageClassName,
  onSlideClick,
  small,
  children,
}: {
  slides: (string | undefined)[];
  sizes: string;
  className?: string;
  logoClassName?: string;
  /** 각 사진(img)에 줄 클래스 — 매체 찾기 카드의 hover 확대 등. */
  imageClassName?: string;
  onSlideClick?: (index: number) => void;
  /** 작은 사진(간략히 보기 88px 등) — 도트를 작게, 장이 많으면(6장 넘음) 도트 대신 "2/8". */
  small?: boolean;
  children?: ReactNode;
}) {
  // 이미지 도트 — 시안엔 도트만 있지만 눌러서 바꿀 수 있게 한다.
  const [imageIndex, setImageIndex] = useState(0);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const draggedRef = useRef(false);
  const [dragDx, setDragDx] = useState(0);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggedRef.current = false;
    // 겹쳐 둔 버튼·체크박스(관심 매체 줄 목록) 위에서 시작한 건 드래그로 보지 않는다 — 끌기가 누름을 가로채지 않게.
    if (
      slides.length < 2 ||
      (event.target as HTMLElement).closest("button, label, input")
    )
      return;
    dragRef.current = { startX: event.clientX, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > 3) drag.moved = true;
    setDragDx(dx);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const dx = event.clientX - drag.startX;
    // 폭의 1/5(최대 60px)을 넘기면 다음/이전 장으로 넘어간다.
    const threshold = Math.min(60, event.currentTarget.clientWidth / 5);
    if (Math.abs(dx) > threshold) {
      setImageIndex((index) =>
        Math.min(slides.length - 1, Math.max(0, index + (dx < 0 ? 1 : -1))),
      );
    }
    setDragDx(0);
    draggedRef.current = drag.moved;
  };

  const handleClickCapture = (event: ReactMouseEvent) => {
    if (!draggedRef.current) return;
    draggedRef.current = false;
    event.stopPropagation();
  };

  return (
    <div
      className={cn(
        "relative touch-pan-y overflow-hidden select-none",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClickCapture={handleClickCapture}
      onClick={
        onSlideClick &&
        ((event) => {
          // 도트·겹친 버튼을 누른 건 크게 보기로 보지 않는다. 사진이 없는 장(로고)도 열 게 없다.
          if ((event.target as HTMLElement).closest("button")) return;
          if (slides[imageIndex]) onSlideClick(imageIndex);
        })
      }
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className={cn(
          "flex h-full w-full",
          // 끄는 동안엔 손을 그대로 따라오고, 놓을 때만 스냅 애니메이션.
          dragDx === 0 && "transition-transform duration-200 ease-out",
          slides.length > 1 && "cursor-grab active:cursor-grabbing",
          slides.length < 2 && onSlideClick && "cursor-zoom-in",
        )}
        style={{
          transform: `translate3d(calc(${-imageIndex * 100}% + ${dragDx}px), 0, 0)`,
        }}
      >
        {slides.map((src, index) => (
          <MediaThumbnail
            key={`${src ?? "empty"}-${index}`}
            src={src}
            sizes={sizes}
            className="size-full shrink-0"
            imageClassName={imageClassName}
            fallback={<Logo className={cn(logoClassName, "opacity-30")} />}
          />
        ))}
      </div>

      {children}

      {small && slides.length > 6 ? (
        <span className="pointer-events-none absolute right-[5px] bottom-[5px] rounded-full bg-black/45 px-[5px] text-[10px] leading-[15px] font-medium text-white tabular-nums">
          {imageIndex + 1}/{slides.length}
        </span>
      ) : (
        slides.length > 1 && (
          <div
            className={cn(
              "absolute left-1/2 flex -translate-x-1/2 items-center",
              small ? "bottom-[6px] gap-[4px]" : "bottom-[9px] gap-[5px]",
            )}
          >
            {slides.map((image, index) => (
              <Button
                key={`${image ?? "empty"}-${index}`}
                aria-label={`${index + 1}번째 이미지`}
                variant="ghost"
                onPress={() => setImageIndex(index)}
                className={cn(
                  "rounded-full bg-surface p-0",
                  small ? "size-[4px] min-w-0" : "size-[5px]",
                  index === imageIndex ? "opacity-100" : "opacity-70",
                )}
              >
                {null}
              </Button>
            ))}
          </div>
        )
      )}
    </div>
  );
}
