"use client";

import { useState } from "react";

import { AiSearchArea } from "./AiSearchArea";
import { LocationSearchArea } from "./LocationSearchArea";
import { ModeToggle, type Mode } from "./ModeToggle";

export function HomeContent() {
  const [mode, setMode] = useState<Mode>("ai");

  return (
    <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-[16px] px-[16px] sm:justify-start sm:gap-[24px] sm:px-0 sm:pt-[35vh]">
      <ModeToggle
        value={mode}
        onChange={setMode}
        className="w-[260px] sm:w-[335px]"
      />
      {mode === "ai" ? <AiSearchArea /> : <LocationSearchArea />}
    </div>
  );
}
