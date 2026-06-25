"use client";

import { SlideBackground } from "./SlideBackground";
import { SlideScaler } from "./SlideScaler";

function formatDate(iso: string | null): string {
  const parsed = iso ? new Date(iso) : null;
  const d = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

function resolveYear(iso: string | null): number {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }
  return new Date().getFullYear();
}

export function CoverTemplate({ updatedAt }: { updatedAt: string | null }) {
  const date = formatDate(updatedAt);
  const year = resolveYear(updatedAt);

  return (
    <div className="relative h-[1080px] w-[1920px] overflow-hidden">
      <SlideBackground />
      <div className="absolute left-[80px] top-[80px] flex flex-col items-start gap-[74px]">
        <div className="h-[24px] w-[740px] bg-white" />
        <div className="flex flex-col text-[120px] leading-none tracking-[-3px] text-white">
          <p className="font-medium">ADMIX</p>
          <p className="font-normal">제안서</p>
        </div>
      </div>
      <div className="absolute left-[80px] top-[812px] flex flex-col gap-[20px]">
        <p className="whitespace-nowrap text-[120px] font-medium leading-none tracking-[-3px] text-white">
          광고 제안서_{year}
        </p>
        <p className="text-[48px] font-medium text-left leading-none tracking-[-1.2px] text-white/70">
          {date}
        </p>
      </div>
    </div>
  );
}

export function CoverSlide({
  updatedAt,
  zoom,
}: {
  updatedAt: string | null;
  zoom: number;
}) {
  return (
    <SlideScaler
      style={{ width: `${zoom}%` }}
      className="relative aspect-[1920/1080] shrink-0 rounded-[8px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <CoverTemplate updatedAt={updatedAt} />
    </SlideScaler>
  );
}

export function CoverThumb({ updatedAt }: { updatedAt: string | null }) {
  return (
    <SlideScaler
      className="absolute inset-0"
      contentClassName="pointer-events-none"
    >
      <CoverTemplate updatedAt={updatedAt} />
    </SlideScaler>
  );
}
