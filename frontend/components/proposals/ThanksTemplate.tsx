"use client";

import { SlideBackground } from "./SlideBackground";
import { SlideScaler } from "./SlideScaler";

export function ThanksTemplate() {
  return (
    <div className="relative flex h-[1080px] w-[1920px] flex-col items-center justify-center overflow-hidden">
      <SlideBackground />
      {/* 가운데 뒤로 흐리게 깔린 심볼 — 가장자리는 바탕색으로 녹인다 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/service/symbol.svg"
        alt=""
        className="pointer-events-none absolute left-1/2 top-1/2 size-[900px] -translate-x-1/2 -translate-y-1/2 select-none opacity-25"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(17,12,34,0.55)_45%,#110c22_80%)]" />

      <div className="relative flex flex-col items-center">
        <p className="text-[22px] font-semibold uppercase leading-none tracking-[0.24em] text-primary-300">
          Advertising Proposal
        </p>
        <p className="mt-[40px] text-[150px] font-bold leading-none tracking-[-3.75px] text-white">
          THANK YOU
        </p>
        <span className="mt-[56px] h-[4px] w-[96px] rounded-full bg-gradient-to-r from-primary-400 to-[#ff7eb3]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/service/admix-text-logo.svg"
          alt="ADMIX"
          className="mt-[48px] h-[44px] w-auto opacity-80 brightness-0 invert"
        />
      </div>
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
