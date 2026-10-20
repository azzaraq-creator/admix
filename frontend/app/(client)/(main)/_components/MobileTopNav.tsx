"use client";

import { Dropdown, Spinner } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";

import { openPageTour, useHasPageTour } from "@/components/common/PageTour";
import { GuideIcon, ProfileAvatarIcon } from "@/components/icons";
import { useHasUserToken, useMe } from "@/hooks/auth";
import { avatarColorClass } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

import { CurrentProposalButton } from "./CurrentProposalButton";
import { GUEST_AVATAR_CLASS, GuestMenu, ProfileMenu } from "./ProfileMenu";
import { useMixieChat } from "./useMixieChat";

/**
 * 상단바 왼쪽 — 사이드 메뉴 대신(메뉴는 하단 탭 바로 옮겼다) 회원이면 프로필 아이콘(누르면 화면 모드·내 정보·
 * 약관·로그아웃 메뉴), 아니면 회색 프로필 아이콘(누르면 화면 모드·로그인 / 회원가입). 회원 정보를 받는 동안엔 스피너.
 * member — 로그인 쿠키가 있는지(서버가 넘긴다). 새로고침 때 비회원 아이콘이 잠깐 보였다 바뀌지 않게.
 */
function MobileUserButton({ member }: { member: boolean }) {
  const { data: me, isError } = useMe();
  // 로그아웃하면 쿠키가 지워지므로 서버 값(member) 대신 지금 쿠키를 본다.
  const hasToken = useHasUserToken(member);
  const BUTTON = "flex h-full w-[48px] shrink-0 items-center justify-center";

  if (hasToken && !me && !isError)
    return (
      <div aria-label="회원 정보를 불러오는 중" className={BUTTON}>
        <Spinner size="sm" />
      </div>
    );
  if (me)
    return (
      <Dropdown>
        <Dropdown.Trigger
          aria-label="프로필 메뉴"
          className={cn(BUTTON, "outline-none")}
        >
          <ProfileAvatarIcon
            className={cn(
              "size-[26px] shrink-0",
              avatarColorClass(me.sns_provider),
            )}
          />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom start" className="min-w-[160px]">
          <ProfileMenu withTheme />
        </Dropdown.Popover>
      </Dropdown>
    );
  return (
    // 비회원 — 회원과 같은 자리의 회색 프로필 아이콘. 누르면 화면 모드 · 로그인 / 회원가입.
    <Dropdown>
      <Dropdown.Trigger
        aria-label="메뉴 (화면 모드 · 로그인)"
        className={cn(BUTTON, "outline-none")}
      >
        <ProfileAvatarIcon
          className={cn("size-[26px] shrink-0", GUEST_AVATAR_CLASS)}
        />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start" className="min-w-[160px]">
        <GuestMenu />
      </Dropdown.Popover>
    </Dropdown>
  );
}

export function MobileTopNav({ member = false }: { member?: boolean }) {
  const { setPanelOpen } = useMixieChat();
  // 지금 페이지에 가이드가 있을 때만 현재 기획안 왼쪽에 아이콘 버튼을 둔다.
  const hasTour = useHasPageTour();
  return (
    <header className="relative flex h-[48px] shrink-0 items-center justify-between bg-surface sm:hidden border-b border-gray-200">
      <MobileUserButton member={member} />
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
          className="dark:invert"
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
