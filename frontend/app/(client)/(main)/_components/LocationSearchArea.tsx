"use client";

import { useState } from "react";

import { LocationSearchInput } from "./LocationSearchInput";

export function LocationSearchArea() {
  const [value, setValue] = useState("");

  return (
    <div className="flex w-full flex-col items-center gap-[16px] sm:gap-[24px]">
      <h1 className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)] sm:text-5xl sm:leading-none sm:tracking-normal">
        어디에 광고하고 싶으세요?
      </h1>

      <LocationSearchInput
        value={value}
        onChange={setValue}
        className="w-full sm:w-[560px] sm:max-w-none"
      />
    </div>
  );
}
