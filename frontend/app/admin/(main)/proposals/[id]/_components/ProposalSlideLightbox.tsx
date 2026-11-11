"use client";

import { Button, Modal } from "@heroui/react";
import { useEffect } from "react";

import { ChevronLeftIcon, XIcon } from "@/components/icons";
import type { ProposalDetail } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

import { AdminSlideView, type AdminSlide } from "./AdminSlideView";

// 어두운 바탕 위 흰 아이콘 버튼 — 눌린 듯 옅게 밝아지기만 한다.
const ICON_BUTTON_CLASS =
  "size-[48px] shrink-0 p-0 text-white data-[hovered=true]:bg-white/10";

type Props = {
  slides: AdminSlide[];
  index: number;
  onIndexChange: (index: number) => void;
  summaryProposal: ProposalDetail | null;
  updatedAt: string | null;
  onClose: () => void;
};

/**
 * 기획안 슬라이드 크게 보기 — HeroUI(react-aria) Modal 로 화면 전체를 덮는다.
 * 좌우 버튼·방향키로 넘기고(끝에서 처음으로 돈다), 아래 썸네일을 누르면 그 장으로 간다. X 버튼·Esc 로 닫는다.
 * 부모가 열 때만 렌더하고 닫히면 언마운트한다.
 */
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

  // 방향키로 넘기기. 포커스가 대화상자 자체에 있을 수도 있어 창 단위로 듣는다(ImageLightbox와 같다).
  useEffect(() => {
    if (total === 0) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft")
        onIndexChange((index - 1 + total) % total);
      else if (event.key === "ArrowRight") onIndexChange((index + 1) % total);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, total, onIndexChange]);

  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop className="bg-scrim/70">
        <Modal.Container className="h-dvh w-screen max-w-none p-0 sm:max-w-none sm:p-0">
          <Modal.Dialog
            aria-label="슬라이드 크게 보기"
            className="flex size-full max-w-none flex-col gap-[16px] rounded-none bg-transparent p-[36px] shadow-none"
          >
            <div className="flex items-center justify-end">
              <Button
                isIconOnly
                variant="ghost"
                onPress={onClose}
                aria-label="닫기"
                className={ICON_BUTTON_CLASS}
              >
                <XIcon className="size-[32px]" />
              </Button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-[16px]">
              <div className="flex min-h-0 flex-1 items-center gap-[52px]">
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={prev}
                  aria-label="이전 슬라이드"
                  className={ICON_BUTTON_CLASS}
                >
                  <ChevronLeftIcon className="size-[48px]" />
                </Button>
                <div className="flex h-full min-w-0 flex-1 items-center justify-center">
                  <div className="relative aspect-[1920/1080] h-full max-w-full overflow-hidden rounded-[4px] bg-surface">
                    {current && (
                      <AdminSlideView
                        slide={current}
                        summaryProposal={summaryProposal}
                        updatedAt={updatedAt}
                      />
                    )}
                  </div>
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={next}
                  aria-label="다음 슬라이드"
                  className={ICON_BUTTON_CLASS}
                >
                  <ChevronLeftIcon className="size-[48px] rotate-180" />
                </Button>
              </div>

              <div className="flex justify-center">
                <div className="rounded-full bg-scrim/60 px-[16px] py-[6px] text-[18px] font-semibold leading-[28px] tracking-[-0.04px]">
                  <span className="text-white">{index + 1} </span>
                  <span className="text-tone-767676">/ {total}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-[8px] overflow-x-auto px-[100px]">
              {slides.map((slide, thumbIndex) => (
                // 썸네일 — 슬라이드 비율(1920:1080)에 높이 68px. 너비는 비율로 정해지게 w-auto.
                <Button
                  key={thumbIndex}
                  variant="ghost"
                  onPress={() => onIndexChange(thumbIndex)}
                  aria-label={`${thumbIndex + 1}번째 슬라이드 · ${slide.name}`}
                  className={cn(
                    "relative aspect-[1920/1080] h-[68px] w-auto shrink-0 overflow-hidden rounded-[4px] bg-surface p-0 transition-opacity data-[hovered=true]:bg-surface",
                    thumbIndex === index
                      ? "ring-2 ring-white"
                      : "opacity-50 data-[hovered=true]:opacity-80",
                  )}
                >
                  <AdminSlideView
                    slide={slide}
                    summaryProposal={summaryProposal}
                    updatedAt={updatedAt}
                  />
                </Button>
              ))}
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
