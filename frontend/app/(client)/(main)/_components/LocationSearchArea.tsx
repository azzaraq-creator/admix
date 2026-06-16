"use client";

import { useState } from "react";

import { SearchIcon } from "./icons";

export function LocationSearchArea() {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col items-center gap-[24px]">
      <h1 className="text-5xl font-bold text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)]">
        어디에 광고하고 싶으세요?
      </h1>

      <div className="flex w-[560px] items-center justify-between gap-[12px] rounded-full border border-primary bg-white px-[24px] py-[10px]">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="강남역 역삼로 10길 6"
          className="min-w-0 flex-1 bg-transparent text-base font-medium text-black outline-none placeholder:text-[#757575]"
        />
        <button
          type="button"
          aria-label="검색"
          className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white"
        >
          <SearchIcon className="size-[18px]" />
        </button>
      </div>
    </div>
  );
}
