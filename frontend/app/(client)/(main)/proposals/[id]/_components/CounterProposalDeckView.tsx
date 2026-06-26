"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/common/buttons";
import { ImageLightbox } from "@/components/common/ImageLightbox";
import {
  DownloadIcon,
  MaximizeIcon,
  MinusIcon,
  PlusIcon,
} from "@/components/icons";
import { StatusChip } from "@/components/proposals/StatusChip";
import { useProposalDetail } from "@/hooks/proposals";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;
const ZOOM_STEP = 25;

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function CounterProposalDeckView({ id }: { id: string }) {
  const { data: proposal } = useProposalDetail(id);
  const [current, setCurrent] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [lightbox, setLightbox] = useState(false);

  const slidesBase = proposal?.counter_proposal_slides_url ?? "";
  const slides = proposal?.counter_proposal_slides ?? [];
  const total = slides.length;
  const src = (file: string) => `${API_BASE}${slidesBase}/${file}`;

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const title = proposal?.title ?? "";

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-[24px] border-b border-[#e8e8e8] bg-white px-[24px] py-[30px]">
          <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
            <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
              {title}
            </p>
            <div className="flex items-center gap-[12px]">
              <StatusChip status={proposal?.status ?? "custom"} />
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                {fmtDateTime(proposal?.updated_at)}
              </p>
            </div>
          </div>
          <Button variant="tertiary" size="md" leftIcon={<DownloadIcon />}>
            내보내기
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e8e8e8]">
            <div className="flex h-[48px] items-center px-[24px]">
              <p className="text-sm font-medium leading-[20px] text-[#757575]">
                슬라이드 <span className="text-primary">{total}</span>
              </p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] py-[16px]">
              {slides.map((slide, index) => (
                <div key={index} className="flex items-start">
                  <p className="w-[20px] shrink-0 pt-[8px] text-sm font-medium leading-[20px] text-[#757575]">
                    {index + 1}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCurrent(index)}
                    className={cn(
                      "ml-[6px] flex min-w-0 flex-1 overflow-hidden rounded-[8px]",
                      current === index
                        ? "ring-2 ring-inset ring-primary"
                        : "ring-1 ring-inset ring-stroke",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src(slide.thumb)}
                      alt={`슬라이드 ${index + 1}`}
                      className="w-full bg-white object-contain"
                      loading="lazy"
                    />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-white p-[40px]">
              {total > 0 && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src(slides[current].image)}
                  alt={`슬라이드 ${current + 1}`}
                  className="rounded-[8px] object-contain shadow-lg"
                  style={{ width: `${zoom}%` }}
                />
              )}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-[40px] flex justify-center">
              <div className="pointer-events-auto flex items-center rounded-[12px] border border-[#f6f6f6] bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setLightbox(true)}
                  aria-label="전체보기"
                  className="border-r border-[#f6f6f6] px-[14px] py-[10px] text-[#2f3442]"
                >
                  <MaximizeIcon className="size-[18px]" />
                </button>
                <div className="flex items-center gap-[20px] px-[14px] py-[10px]">
                  <button
                    type="button"
                    onClick={() => setZoom((v) => Math.max(ZOOM_MIN, v - ZOOM_STEP))}
                    aria-label="축소"
                    className="text-[#2f3442]"
                  >
                    <MinusIcon className="size-[18px]" />
                  </button>
                  <span className="w-[36px] text-center text-sm font-medium leading-[20px] text-black">
                    {zoom}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoom((v) => Math.min(ZOOM_MAX, v + ZOOM_STEP))}
                    aria-label="확대"
                    className="text-[#2f3442]"
                  >
                    <PlusIcon className="size-[18px]" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {lightbox && (
        <ImageLightbox
          images={slides.map((slide) => src(slide.image))}
          initialIndex={current}
          onClose={() => setLightbox(false)}
        />
      )}

      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-[16px] sm:hidden">
        <div className="flex w-[343px] flex-col overflow-hidden rounded-[12px] bg-white">
          <div className="flex flex-col items-center gap-[16px] px-[24px] py-[16px]">
            <p className="text-center text-base font-semibold leading-[24px] text-[#2f3442]">
              해당 기능은 모바일에서 지원되지 않습니다.
              <br />
              데스크톱으로 이용해주시기 바랍니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
