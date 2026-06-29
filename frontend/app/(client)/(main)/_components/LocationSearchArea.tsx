"use client";

import { useRouter } from "next/navigation";

import { SearchIcon } from "@/components/icons";

export function LocationSearchArea() {
  const router = useRouter();
  const goToSearch = () => router.push("/fixed?mode=search");

  return (
    <div className="flex w-full flex-col items-center gap-[16px] sm:gap-[24px]">
      <h1 className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-center text-white [text-shadow:0px_0px_4px_rgba(0,0,0,0.36)] sm:text-5xl sm:leading-none sm:tracking-normal">
        어디에 광고하고 싶으세요?
      </h1>

      <div
        role="button"
        tabIndex={0}
        onClick={goToSearch}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            goToSearch();
          }
        }}
        className="flex w-full cursor-pointer items-center justify-between gap-[12px] rounded-full border border-primary bg-white px-[24px] py-[10px] sm:w-[560px] sm:max-w-none"
      >
        <p className="min-w-0 flex-1 truncate text-base font-medium text-[#757575]">
          강남역 역삼로 10길 6
        </p>
        <span className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white">
          <SearchIcon className="size-[18px]" />
        </span>
      </div>
    </div>
  );
}
