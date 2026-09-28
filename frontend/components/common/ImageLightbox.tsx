"use client";

import { Button, Modal } from "@heroui/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "@/components/icons";
import { isOptimizable, mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

const NAV_BUTTON_CLASS =
  "absolute top-1/2 z-10 size-[48px] -translate-y-1/2 rounded-full bg-white/15 p-0 text-white backdrop-blur-sm data-[hovered=true]:bg-white/30 data-[disabled=true]:opacity-0";

/**
 * 이미지 크게 보기. 좌우 버튼·방향키·끌어서 넘기기로 이미지를 바꾸고,
 * 이미지 바깥 빈 곳이나 X 버튼, Esc로 닫는다.
 *
 * 매체 상세 모달 위에 겹쳐 뜨므로 같은 HeroUI(react-aria) Modal로 만든다 — 모달끼리는
 * 포커스 트랩·Esc가 위에 뜬 것부터 차례로 처리된다. 부모가 열 때만 렌더하고 닫히면 언마운트한다.
 */
/** object-contain으로 그려진 이미지에서, 실제 그림이 차지한 영역 안을 눌렀는지. */
function isOnRenderedImage(
  img: HTMLImageElement,
  event: ReactMouseEvent,
): boolean {
  const box = img.getBoundingClientRect();
  if (!img.naturalWidth || !img.naturalHeight) return true;
  const scale = Math.min(
    box.width / img.naturalWidth,
    box.height / img.naturalHeight,
  );
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const left = box.left + (box.width - w) / 2;
  const top = box.top + (box.height - h) / 2;
  return (
    event.clientX >= left &&
    event.clientX <= left + w &&
    event.clientY >= top &&
    event.clientY <= top + h
  );
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [dragDx, setDragDx] = useState(0);
  const dragRef = useRef<{ startX: number; moved: boolean } | null>(null);
  const draggedRef = useRef(false);

  const count = images.length;
  const go = (delta: number) =>
    setIndex((i) => Math.min(count - 1, Math.max(0, i + delta)));

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggedRef.current = false;
    if (count < 2 || (event.target as HTMLElement).closest("button")) return;
    // 포인터 캡처는 실제로 끌기 시작할 때만 건다 — 누르자마자 걸면 클릭 대상이 이 컨테이너로
    // 바뀌어 "이미지를 눌렀는지"를 알 수 없게 된다.
    dragRef.current = { startX: event.clientX, moved: false };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (drag.moved) setDragDx(dx);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    const dx = event.clientX - drag.startX;
    if (Math.abs(dx) > Math.min(80, window.innerWidth / 6))
      go(dx < 0 ? 1 : -1);
    setDragDx(0);
    draggedRef.current = drag.moved;
  };

  // 화면 전체가 대화상자라 "바깥 클릭"이 따로 없다. 이미지·버튼이 아닌 곳을 누르면 닫는다.
  // 이미지는 박스를 꽉 채운 채 object-contain으로 그려지므로, 위아래·좌우 여백(레터박스)을
  // 누른 것도 빈 곳으로 친다. 끌어서 넘긴 직후의 클릭은 닫기로 치지 않는다.
  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (target instanceof HTMLImageElement && isOnRenderedImage(target, event))
      return;
    onClose();
  };

  // 방향키로 넘기기. 포커스가 대화상자 자체에 있을 수도 있어 창 단위로 듣는다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      const delta = event.key === "ArrowLeft" ? -1 : 1;
      setIndex((i) => Math.min(count - 1, Math.max(0, i + delta)));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [count]);

  return (
    <Modal
      isOpen
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      {/* 프로젝트의 black 토큰은 남색 계열이라, 사진이 돋보이도록 순수 검정으로 깐다. */}
      <Modal.Backdrop className="bg-[rgba(0,0,0,0.88)]">
        <Modal.Container className="h-dvh w-screen max-w-none p-0 sm:max-w-none sm:p-0">
          <Modal.Dialog
            aria-label="이미지 크게 보기"
            className="relative size-full max-w-none gap-0 rounded-none bg-transparent p-0 shadow-none"
          >
            <div
              className="relative flex size-full touch-pan-y items-center justify-center overflow-hidden select-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerEnd}
              onPointerCancel={handlePointerEnd}
              onClick={handleClick}
              onDragStart={(event) => event.preventDefault()}
            >
              <div
                className={cn(
                  "flex h-full w-full",
                  dragDx === 0 && "transition-transform duration-250 ease-out",
                  count > 1 && "cursor-grab active:cursor-grabbing",
                )}
                style={{
                  transform: `translate3d(calc(${-index * 100}% + ${dragDx}px), 0, 0)`,
                }}
              >
                {images.map((src, i) => {
                  const resolved = mediaSrc(src);
                  return (
                    <div
                      key={`${src}-${i}`}
                      className="size-full shrink-0 px-[16px] py-[72px] sm:px-[96px]"
                    >
                      {/* 작은 원본도 화면에 맞춰 키워 보이도록 박스를 채우고 비율은 유지한다.
                          가까운 장만 불러온다(멀리 있는 장은 넘길 때 로드). */}
                      <div className="relative size-full">
                        {Math.abs(i - index) <= 1 && (
                          <Image
                            src={resolved}
                            alt={`${i + 1}번째 이미지`}
                            fill
                            sizes="100vw"
                            unoptimized={!isOptimizable(resolved)}
                            draggable={false}
                            className="object-contain"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {count > 1 && (
                <>
                  <Button
                    isIconOnly
                    variant="ghost"
                    aria-label="이전 이미지"
                    isDisabled={index === 0}
                    onPress={() => go(-1)}
                    className={cn(NAV_BUTTON_CLASS, "left-[16px] sm:left-[28px]")}
                  >
                    <ChevronLeftIcon className="size-[26px]" />
                  </Button>
                  <Button
                    isIconOnly
                    variant="ghost"
                    aria-label="다음 이미지"
                    isDisabled={index === count - 1}
                    onPress={() => go(1)}
                    className={cn(
                      NAV_BUTTON_CLASS,
                      "right-[16px] sm:right-[28px]",
                    )}
                  >
                    <ChevronRightIcon className="size-[26px]" />
                  </Button>
                  <p className="pointer-events-none absolute bottom-[28px] left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-[12px] py-[4px] text-[13px] font-medium text-white tabular-nums">
                    {index + 1} / {count}
                  </p>
                </>
              )}

              <Button
                isIconOnly
                variant="ghost"
                aria-label="크게 보기 닫기"
                onPress={onClose}
                className="absolute top-[16px] right-[16px] z-10 size-[44px] rounded-full bg-white/15 p-0 text-white backdrop-blur-sm data-[hovered=true]:bg-white/30 sm:top-[24px] sm:right-[24px]"
              >
                <XIcon className="size-[22px]" />
              </Button>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
