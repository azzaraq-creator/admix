"use client";

import { Button, Dropdown, Spinner } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";

import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ProfileAvatarIcon,
} from "@/components/icons";
import {
  GUEST_AVATAR_CLASS,
  ProfileMenu,
} from "@/app/(client)/(main)/_components/ProfileMenu";
import { ThemeMenu } from "@/app/(client)/(main)/_components/ThemeMenu";
import { openLoginModal } from "@/app/(client)/(main)/_components/useLoginModal";
import {
  setLnbCollapsed,
  useLnbCollapsed,
} from "@/app/(client)/(main)/_components/useLnb";
import { avatarColorClass } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

import {
  fadeLabel,
  PartnersLogo,
  usePartnersNav,
  type PartnersMenuItem,
} from "./partnersNav";
import {
  PartnersMobileHeader,
  PartnersMobileTabBar,
} from "./PartnersMobileNav";
import { PartnerNotificationCard } from "./workspace/PartnerNotifications";

// admix 사이드바(Sidebar.tsx)와 같은 줄 모양 — 38px(곡률 16px), 아이콘 18px.
// 아이콘 가운데는 x=39px 열(접힌 폭 78px의 가운데) — 접고 펼쳐도 아이콘이 제자리에 남는다.
const NAV_ROW =
  "flex h-[38px] w-full items-center gap-[9px] overflow-hidden rounded-[16px] pr-[12px] pl-[20px] transition-colors";

/**
 * /partners 왼쪽 사이드바 — admix 사이드바와 같은 틀(로고 · 메뉴 · 아래 화면 모드 · 프로필/로그인).
 * PC는 admix와 같은 180px ↔ 78px 접기(접힘 상태도 admix와 같이 쓴다).
 * 모바일은 사이드바 대신 위 띠(로고 · 알림 · 프로필) + 아래 탭 바(PartnersMobileNav, 11-08 — 예전 드로어를 바꿨다).
 * member — 로그인 쿠키 유무(서버가 넘긴다). 있으면 회원 정보를 받는 동안 로그인 버튼 대신 스피너.
 */
export function PartnersSidebar({ member = false }: { member?: boolean }) {
  const collapsed = useLnbCollapsed();
  const {
    me,
    meLoading,
    hasStore,
    menuLoading,
    menu,
    activeKey,
    logoHref,
    onMenuClick,
  } = usePartnersNav(member);
  const displayName = me?.name?.trim() ? me.name : "회원";

  const row = (item: PartnersMenuItem) => {
    const active = item.key === activeKey;
    const { Icon } = item;
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          // 누르자마자 본문을 로딩 화면으로 — 다음 화면 응답을 기다리는 동안 안 눌린 것처럼 보이지 않게.
          onClick={(e) => onMenuClick(e, item.href)}
          aria-current={active ? "page" : undefined}
          aria-label={item.label}
          title={collapsed ? item.label : undefined}
          className={cn(
            NAV_ROW,
            active
              ? "bg-primary-100 font-bold text-primary"
              : "font-medium text-gray-900 hover:bg-tone-f7f3fe",
          )}
        >
          <Icon className="size-[18px] shrink-0" />
          <span
            className={cn("text-sm whitespace-nowrap", fadeLabel(collapsed))}
          >
            {item.label}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <>
      <PartnersMobileHeader member={member} />
      <PartnersMobileTabBar member={member} />

      {/* 본문 자리(aside) 폭도 nav와 같이 움직여 경계선이 먼저 튀어나오지 않게 한다. 모바일은 폭 0(사이드바 없음). */}
      <aside
        className={cn(
          "relative w-0 shrink-0 transition-[width] duration-300 ease-in-out",
          collapsed ? "sm:w-[78px]" : "sm:w-[180px]",
        )}
      >
        <nav
          aria-label="콜라보 사이드바"
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden h-dvh w-[180px] flex-col justify-between border-r border-gray-200 bg-surface p-[10px] transition-[width] duration-300 ease-in-out sm:flex",
            collapsed && "sm:w-[78px]",
          )}
        >
          {/* 접기/펼치기 — admix와 같이 사이드바 오른쪽 가장자리에 걸쳐 둔다(24px → 곡률 9px). */}
          <Button
            isIconOnly
            variant="ghost"
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!collapsed}
            onPress={() => setLnbCollapsed(!collapsed)}
            className="absolute top-[28px] -right-[12px] hidden size-[24px] min-w-0 rounded-[9px] border border-gray-200 bg-surface p-0 text-gray-500 shadow-[0_2px_6px_rgba(0,0,0,0.08)] data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-gray-900 sm:flex"
          >
            <ChevronLeftIcon
              className={cn(
                "size-[14px] transition-transform duration-300",
                collapsed && "rotate-180",
              )}
            />
          </Button>

          <div className="flex flex-col">
            <div className="mt-[15px]">
              <PartnersLogo collapsed={collapsed} href={logoHref} />
            </div>

            {/* 회원 정보 · 매장 여부를 받는 동안은 메뉴 · 구분선 · 돌아가기 줄을 통째로 비워 두고, 다 받으면 한 번에 그린다
                (새 탭으로 열 때 비회원용 "소개" 메뉴가 잠깐 보이거나 돌아가기 줄이 아래로 밀려 내려가지 않게). */}
            {!menuLoading && (
              <>
                <ul className="mt-[30px] flex flex-col gap-[3px]">
                  {menu.map(row)}
                </ul>

                {/* 메뉴와 admix로 돌아가기 사이 구분선(알림 아래 구분선과 같은 모양). */}
                <hr className="mx-[6px] mt-[12px] mb-[8px] border-t border-gray-200" />

                {/* admix로 돌아가기 — 소개 메뉴 밑 작은 줄(← + admix 글자 로고). 마우스를 올리면 화살표가 왼쪽으로 움직인다. */}
                <Link
                  href="/"
                  aria-label="admix로 돌아가기"
                  title="admix로 돌아가기"
                  className={cn(
                    // 메뉴보다 한 단계 작은 보조 줄(32px → 곡률 13px). 아이콘 가운데는 메뉴와 같은 x=39px 열.
                    "group flex h-[32px] w-full items-center gap-[8px] overflow-hidden rounded-[13px] pr-[12px] pl-[21px] text-gray-400 transition-colors outline-none hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-200",
                  )}
                >
                  <ArrowLeftIcon className="size-[16px] shrink-0 transition-transform duration-200 ease-out group-hover:-translate-x-[4px]" />
                  {/* 글자 로고는 검은 그림이라 옅게 두고, 마우스를 올리면 진하게. */}
                  <span className={cn("flex shrink-0", fadeLabel(collapsed))}>
                    <Image
                      src="/service/admix-text-logo.svg"
                      alt=""
                      width={43}
                      height={12}
                      className="h-[12px] w-auto opacity-50 transition-opacity group-hover:opacity-100 dark:brightness-0 dark:invert"
                    />
                  </span>
                </Link>
              </>
            )}
          </div>

          <div className="pb-[10px]">
            {/* 알림 — 화면 모드 위, 사이에 구분선. 모바일은 위 띠의 종 아이콘. */}
            {hasStore && (
              <div>
                <PartnerNotificationCard collapsed={collapsed} />
                <hr className="mx-[6px] my-[14px] border-t border-gray-200" />
              </div>
            )}
            {/* 화면 모드 — admix 사이드바와 같은 보조 줄(32px → 곡률 13px). */}
            <ThemeMenu
              placement={collapsed ? "right bottom" : "top start"}
              className={cn(
                "mb-[12px] flex h-[32px] w-full items-center gap-[9px] overflow-hidden rounded-[13px] text-[13px] font-medium text-gray-500 outline-none transition-[padding,background-color,color] duration-300 ease-in-out hover:bg-gray-50 hover:text-gray-900",
                collapsed ? "px-[13px] sm:pr-0 sm:pl-[20px]" : "px-[13px]",
              )}
              labelClassName={cn("whitespace-nowrap", fadeLabel(collapsed))}
            />
            {meLoading ? (
              <div
                role="status"
                aria-label="회원 정보를 불러오는 중"
                className="flex h-[24px] items-center pl-[17px]"
              >
                <Spinner size="sm" />
              </div>
            ) : me ? (
              <div className="pr-[10px] pl-[17px]">
                <Dropdown>
                  <Dropdown.Trigger
                    aria-label="프로필 메뉴"
                    className="flex w-full items-center gap-[10px] overflow-hidden rounded-[10px] outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary-200"
                  >
                    <ProfileAvatarIcon
                      className={cn(
                        "size-[24px] shrink-0",
                        avatarColorClass(me.sns_provider),
                      )}
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-left text-sm font-medium text-black",
                        fadeLabel(collapsed),
                      )}
                    >
                      {displayName} 님
                    </span>
                    <ChevronRightIcon
                      className={cn(
                        "size-[16px] shrink-0 text-black",
                        fadeLabel(collapsed),
                      )}
                    />
                  </Dropdown.Trigger>
                  <Dropdown.Popover
                    // 접혔을 땐 트리거가 좁아 오른쪽으로 연다.
                    placement={collapsed ? "right bottom" : "top start"}
                    className="w-(--trigger-width) min-w-[160px]"
                  >
                    <ProfileMenu
                      profileHref="/partners/profile"
                      helpHref="/partners/help"
                    />
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            ) : (
              // 비회원 — admix와 같은 "로그인 / 회원가입" 줄. 누르면 로그인 창(회원가입은 창 안에서).
              <div className="pr-[10px] pl-[17px]">
                <button
                  type="button"
                  aria-label="로그인 / 회원가입"
                  title={collapsed ? "로그인 / 회원가입" : undefined}
                  onClick={openLoginModal}
                  className="flex w-full items-center gap-[10px] overflow-hidden rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-primary-200"
                >
                  <ProfileAvatarIcon
                    className={cn("size-[24px] shrink-0", GUEST_AVATAR_CLASS)}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-left text-sm font-medium text-black",
                      fadeLabel(collapsed),
                    )}
                  >
                    로그인 / 회원가입
                  </span>
                </button>
              </div>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
