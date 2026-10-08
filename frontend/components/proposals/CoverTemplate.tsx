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

// 기획안명이 비어 있으면 예전 표기(광고 기획안_연도)로 대신한다.
export function CoverTemplate({
  title,
  updatedAt,
}: {
  title?: string | null;
  updatedAt: string | null;
}) {
  const date = formatDate(updatedAt);
  const heading = title?.trim() || `광고 기획안_${resolveYear(updatedAt)}`;

  return (
    <div className="relative h-[1080px] w-[1920px] overflow-hidden">
      <SlideBackground />
      {/* 오른쪽에 크게 걸친 심볼 — 왼쪽 글씨 쪽은 바탕색으로 덮어 읽기 쉽게 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/service/symbol.svg"
        alt=""
        className="pointer-events-none absolute -right-[140px] top-[110px] size-[860px] select-none opacity-90"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-[#110c22] via-[#110c22]/70 to-transparent" />

      <div className="absolute left-[120px] top-[112px] flex items-center gap-[28px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/service/admix-text-logo.svg"
          alt="ADMIX"
          className="h-[56px] w-auto brightness-0 invert"
        />
        <span className="h-[40px] w-[2px] bg-white/30" />
        <p className="text-[44px] font-semibold leading-none tracking-[-1.1px] text-white">
          기획안
        </p>
      </div>

      <div className="absolute bottom-[136px] left-[120px] flex w-[1080px] flex-col">
        <p className="text-[22px] font-semibold uppercase leading-none tracking-[0.24em] text-primary-300">
          Advertising Proposal
        </p>
        <p className="mt-[32px] line-clamp-2 text-[96px] font-bold leading-[1.15] tracking-[-2.4px] text-white [word-break:keep-all]">
          {heading}
        </p>
        <span className="mt-[48px] h-[4px] w-[96px] rounded-full bg-gradient-to-r from-primary-400 to-[#ff7eb3]" />
        <p className="mt-[28px] text-[32px] font-medium leading-none tracking-[-0.8px] text-white/60 tabular-nums">
          {date}
        </p>
      </div>
    </div>
  );
}

export function CoverSlide({
  title,
  updatedAt,
  zoom,
}: {
  title?: string | null;
  updatedAt: string | null;
  zoom: number;
}) {
  return (
    <SlideScaler
      style={{ width: `${zoom}%` }}
      className="relative aspect-[1920/1080] shrink-0 rounded-[8px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <CoverTemplate title={title} updatedAt={updatedAt} />
    </SlideScaler>
  );
}

export function CoverThumb({
  title,
  updatedAt,
}: {
  title?: string | null;
  updatedAt: string | null;
}) {
  return (
    <SlideScaler
      className="absolute inset-0"
      contentClassName="pointer-events-none"
    >
      <CoverTemplate title={title} updatedAt={updatedAt} />
    </SlideScaler>
  );
}
