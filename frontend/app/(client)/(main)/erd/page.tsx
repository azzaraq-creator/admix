"use client";

import { useState } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const STEP = 0.25;

export default function ErdPage() {
  const [zoom, setZoom] = useState(1);

  const clamp = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))));

  return (
    <div className="relative h-dvh w-full bg-white">
      <div className="absolute right-[24px] top-[24px] z-10 flex items-center gap-[4px] rounded-[8px] border border-stroke bg-white/90 p-[4px] shadow-md backdrop-blur">
        <button
          type="button"
          aria-label="축소"
          onClick={() => setZoom((z) => clamp(z - STEP))}
          className="flex size-[32px] items-center justify-center rounded-[6px] text-[20px] text-black hover:bg-platinum-100"
        >
          −
        </button>
        <span className="min-w-[52px] text-center text-sm font-medium text-black">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          aria-label="확대"
          onClick={() => setZoom((z) => clamp(z + STEP))}
          className="flex size-[32px] items-center justify-center rounded-[6px] text-[20px] text-black hover:bg-platinum-100"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setZoom(1)}
          className="ml-[4px] rounded-[6px] px-[10px] py-[6px] text-sm font-medium text-black hover:bg-platinum-100"
        >
          원본
        </button>
      </div>

      <div className="h-full w-full overflow-auto p-[24px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/admix-erd.svg"
          alt="Admix ERD"
          style={{ width: `${zoom * 100}%` }}
          className="max-w-none"
        />
      </div>
    </div>
  );
}
