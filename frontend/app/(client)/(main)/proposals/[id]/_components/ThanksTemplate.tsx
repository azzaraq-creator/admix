"use client";

import { SlideScaler } from "./SlideScaler";

const PATTERN = "/proposals/thanks-pattern.png";

export function ThanksTemplate() {
  return (
    <div className="relative flex h-[1080px] w-[1920px] items-center justify-center overflow-hidden bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={PATTERN}
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 size-[1324px] -translate-x-1/2 -translate-y-1/2 object-cover opacity-70"
      />
      <div className="absolute inset-0 bg-black opacity-70" />
      <p className="relative text-[120px] font-semibold leading-[1.4] tracking-[-3px] text-white">
        THANK YOU
      </p>
    </div>
  );
}

export function ThanksSlide({ zoom }: { zoom: number }) {
  return (
    <SlideScaler
      style={{ width: `${zoom}%` }}
      className="relative aspect-[1920/1080] shrink-0 rounded-[8px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <ThanksTemplate />
    </SlideScaler>
  );
}

export function ThanksThumb() {
  return (
    <SlideScaler className="absolute inset-0" contentClassName="pointer-events-none">
      <ThanksTemplate />
    </SlideScaler>
  );
}
