"use client";

import Image from "next/image";
import Link from "next/link";

import { setLnbExpanded } from "./useLnb";

export function MobileTopNav() {
  return (
    <header className="flex h-[48px] shrink-0 items-center justify-between bg-white sm:hidden border-b border-gray-200">
      <button
        type="button"
        aria-label="메뉴 열기"
        onClick={() => setLnbExpanded(true)}
        className="flex h-full w-[48px] shrink-0 items-center justify-center"
      >
        <Image src="/icons/side-menu.svg" alt="" width={18} height={16} />
      </button>
      <Link
        href="/"
        aria-label="홈"
        className="flex h-full flex-1 items-center justify-center"
      >
        {/* 원본 833×236 비율을 유지해 높이 16px로 맞춘다. */}
        <Image
          src="/service/admix-text-logo.svg"
          alt=""
          width={56}
          height={16}
          priority
        />
      </Link>
      {/* 로고를 가운데 두기 위해 왼쪽 메뉴 버튼과 같은 폭을 비워 둔다. */}
      <div className="w-[48px] shrink-0" />
    </header>
  );
}
