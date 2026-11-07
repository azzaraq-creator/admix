"use client";

import { Button, Modal } from "@heroui/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef } from "react";

import { MediaImage } from "@/components/common/MediaImage";
import { mediaSrc } from "@/lib/media";
import { cn } from "@/lib/utils";

/**
 * 매장 사진 갤러리 — 어두운 바탕에 큰 사진 한 장, 좌우 넘기기(버튼 · ← → 키), 아래 작은 사진 줄.
 * index 가 null 이면 닫힘. HeroUI Modal.
 */
export function StoreGalleryModal({
  images,
  name,
  index,
  onIndexChange,
}: {
  images: string[];
  name: string;
  index: number | null;
  onIndexChange: (i: number | null) => void;
}) {
  const open = index !== null;
  const i = index ?? 0;
  const total = images.length;
  const go = (d: number) => onIndexChange((i + d + total) % total);
  const stripRef = useRef<HTMLDivElement>(null);

  // ← → 키로 넘기기.
  useEffect(() => {
    if (!open || total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") onIndexChange((i - 1 + total) % total);
      if (e.key === "ArrowRight") onIndexChange((i + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, i, total, onIndexChange]);

  // 지금 사진의 작은 사진이 줄 안에 보이게.
  useEffect(() => {
    if (!open) return;
    stripRef.current
      ?.querySelector<HTMLElement>(`[data-thumb="${i}"]`)
      ?.scrollIntoView({
        block: "nearest",
        inline: "center",
        behavior: "smooth",
      });
  }, [open, i]);

  return (
    <Modal isOpen={open} onOpenChange={(v) => !v && onIndexChange(null)}>
      <Modal.Backdrop className="bg-black/85 backdrop-blur-sm">
        <Modal.Container placement="center" className="px-0">
          <Modal.Dialog
            aria-label={`${name} 사진`}
            className="flex h-dvh w-screen max-w-none flex-col gap-0 rounded-none bg-transparent p-0 text-white shadow-none"
          >
            {/* 위 — 몇 번째 · 닫기 */}
            <div className="flex items-center justify-between px-[16px] py-[14px] sm:px-[24px]">
              <span className="text-[14px] font-semibold tabular-nums">
                <b className="text-white">{i + 1}</b>
                <span className="text-white/50"> / {total}</span>
                <span className="ml-[10px] text-white/60">{name}</span>
              </span>
              <Modal.CloseTrigger
                aria-label="닫기"
                className="static size-[36px] rounded-[13px] bg-white/10 text-white hover:bg-white/20"
              />
            </div>

            {/* 가운데 — 큰 사진 + 좌우 버튼 */}
            <div className="relative min-h-0 flex-1">
              {images[i] && (
                <MediaImage
                  key={images[i]}
                  src={mediaSrc(images[i])}
                  alt={`${name} 사진 ${i + 1}`}
                  fill
                  sizes="100vw"
                  className="animate-in fade-in object-contain duration-200"
                />
              )}
              {total > 1 && (
                <>
                  <Button
                    isIconOnly
                    aria-label="이전 사진"
                    onPress={() => go(-1)}
                    className="absolute top-1/2 left-[12px] size-[44px] -translate-y-1/2 rounded-[16px] bg-white/10 text-white backdrop-blur-md hover:bg-white/20 sm:left-[24px]"
                  >
                    <ChevronLeft className="size-[22px]" />
                  </Button>
                  <Button
                    isIconOnly
                    aria-label="다음 사진"
                    onPress={() => go(1)}
                    className="absolute top-1/2 right-[12px] size-[44px] -translate-y-1/2 rounded-[16px] bg-white/10 text-white backdrop-blur-md hover:bg-white/20 sm:right-[24px]"
                  >
                    <ChevronRight className="size-[22px]" />
                  </Button>
                </>
              )}
            </div>

            {/* 아래 — 작은 사진 줄 */}
            {total > 1 && (
              <div
                ref={stripRef}
                className="flex justify-center-safe gap-[8px] overflow-x-auto px-[16px] py-[16px]"
              >
                {images.map((url, k) => (
                  <button
                    key={url}
                    type="button"
                    data-thumb={k}
                    aria-label={`${k + 1}번째 사진`}
                    aria-current={k === i}
                    onClick={() => onIndexChange(k)}
                    className={cn(
                      "relative size-[56px] shrink-0 overflow-hidden rounded-[12px] ring-2 transition sm:size-[64px]",
                      k === i
                        ? "opacity-100 ring-white"
                        : "opacity-50 ring-transparent hover:opacity-90",
                    )}
                  >
                    <MediaImage
                      src={mediaSrc(url)}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
