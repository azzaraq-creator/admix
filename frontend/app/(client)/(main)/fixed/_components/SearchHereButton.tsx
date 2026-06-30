"use client";

import { RotateCwIcon } from "@/components/icons";

export function SearchHereButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-[4px] rounded-full border border-primary bg-white px-[12px] py-[8px] text-[14px] font-medium leading-[20px] text-primary shadow-[0px_2px_8px_rgba(0,0,0,0.12)]"
    >
      <RotateCwIcon className="size-[18px]" />
      현재 위치 검색
    </button>
  );
}
