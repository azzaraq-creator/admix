"use client";

import Link from "next/link";

import { Logo, MenuIcon } from "@/components/icons";
import { setLnbExpanded } from "./useLnb";

export function MobileTopNav() {
  return (
    <header className="flex h-[56px] shrink-0 items-center justify-between bg-white sm:hidden border-b border-gray-200">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setLnbExpanded(true)}
        className="flex items-center p-[16px] text-black"
      >
        <MenuIcon className="size-[24px]" />
      </button>
      <Link
        href="/"
        aria-label="홈"
        className="flex flex-1 items-center justify-center p-[16px]"
      >
        <Logo className="size-[24px]" />
      </Link>
      <div className="size-[56px] shrink-0" />
    </header>
  );
}
