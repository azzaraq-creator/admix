"use client";

import { useState } from "react";

import { AiSearchArea } from "./AiSearchArea";
import { LocationSearchArea } from "./LocationSearchArea";
import { ModeToggle, type Mode } from "./ModeToggle";

export function HomeContent() {
  const [mode, setMode] = useState<Mode>("ai");

  return (
    <div className="relative z-10 flex w-full flex-col items-center gap-[24px] pt-[35vh]">
      <ModeToggle value={mode} onChange={setMode} />
      {mode === "ai" ? <AiSearchArea /> : <LocationSearchArea />}
    </div>
  );
}
