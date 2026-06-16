"use client";

import { useState } from "react";

import { LocationSearchInput } from "./LocationSearchInput";

export function LocationSearchArea() {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col items-center gap-[24px]">
      <h1 className="text-5xl font-bold text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)]">
        어디에 광고하고 싶으세요?
      </h1>

      <LocationSearchInput
        value={value}
        onChange={setValue}
        className="w-[560px]"
      />
    </div>
  );
}
