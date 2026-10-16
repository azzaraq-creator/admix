"use client";

import Image from "next/image";
import Link from "next/link";

import { openPageTour, useHasPageTour } from "@/components/common/PageTour";
import { GuideIcon } from "@/components/icons";

import { CurrentProposalButton } from "./CurrentProposalButton";
import { setLnbExpanded } from "./useLnb";
import { useMixieChat } from "./useMixieChat";

export function MobileTopNav() {
  const { setPanelOpen } = useMixieChat();
  // 지금 페이지에 가이드가 있을 때만 현재 기획안 왼쪽에 아이콘 버튼을 둔다.
  const hasTour = useHasPageTour();
  return (
    <header className="relative flex h-[48px] shrink-0 items-center justify-between bg-white sm:hidden border-b border-gray-200">
      <button
        type="button"
        aria-label="메뉴 열기"
        data-tour="mobile-menu"
        onClick={() => setLnbExpanded(true)}
        className="flex h-full w-[48px] shrink-0 items-center justify-center"
      >
        <Image src="/icons/side-menu.svg" alt="" width={18} height={16} />
      </button>
      {/* 로고는 오른쪽 버튼 수(가이드 유무)와 관계없이 화면 가운데에 둔다. */}
      <Link
        href="/"
        aria-label="홈"
        className="absolute inset-y-0 left-1/2 flex -translate-x-1/2 items-center justify-center px-[8px]"
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
      <div className="flex h-full">
        {hasTour && (
          // 현재 기획안 버튼(48px)보다 좁게 — 두 아이콘이 붙어 한 묶음으로 보이게.
          <button
            type="button"
            aria-label="가이드"
            onClick={() => {
              setPanelOpen(false);
              openPageTour();
            }}
            className="flex h-full w-[36px] shrink-0 items-center justify-center text-gray-900"
          >
            {/* 원본 22×20 비율로 폭 20px(옆 기획안 아이콘과 같은 크기). */}
            <GuideIcon aria-hidden className="h-[18px] w-[20px]" />
          </button>
        )}
        <CurrentProposalButton variant="header" />
      </div>
    </header>
  );
}
