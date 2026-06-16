"use client";

import { SparkleIcon } from "./icons";

export type Mode = "ai" | "search";

export function ModeToggle({
  value,
  onChange,
}: {
  value: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div className="flex w-[335px] items-center gap-[6px] rounded-full bg-[#f1f5f9] p-[8px]">
      <button
        type="button"
        onClick={() => onChange("ai")}
        className="relative flex flex-1 items-center justify-center rounded-full px-[16px] py-[8px]"
      >
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-primary transition-opacity duration-300 ease-out ${
            value === "ai" ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          className={`relative z-10 flex items-center gap-[10px] transition-colors duration-300 ${
            value === "ai" ? "text-white" : "text-[#757575]"
          }`}
        >
          <SparkleIcon className="size-[16px] shrink-0" />
          <span className="text-sm font-medium whitespace-nowrap">AI 매체 추천</span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onChange("search")}
        className="relative flex flex-1 items-center justify-center rounded-full px-[16px] py-[8px]"
      >
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-primary transition-opacity duration-300 ease-out ${
            value === "search" ? "opacity-100" : "opacity-0"
          }`}
        />
        <span
          className={`relative z-10 text-sm font-medium whitespace-nowrap transition-colors duration-300 ${
            value === "search" ? "text-white" : "text-[#757575]"
          }`}
        >
          매체 검색
        </span>
      </button>
    </div>
  );
}
