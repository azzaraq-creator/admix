"use client";

import { SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type LocationSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
};

export function LocationSearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "강남역 역삼로 10길 6",
  className,
}: LocationSearchInputProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      className={cn(
        "flex items-center justify-between gap-[12px] rounded-full border border-primary bg-white px-[24px] py-[10px]",
        className,
      )}
    >
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className=" min-w-0 flex-1 bg-transparent text-base font-medium text-black outline-none placeholder:text-[#757575]"
      />
      <button
        type="submit"
        aria-label="검색"
        className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white"
      >
        <SearchIcon className="size-[18px]" />
      </button>
    </form>
  );
}
