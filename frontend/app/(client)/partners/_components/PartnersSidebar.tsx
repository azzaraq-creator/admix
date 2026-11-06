"use client";

import { Button, Dropdown, Spinner } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store } from "lucide-react";
import { useState, type ComponentType, type SVGProps } from "react";

import {
  ArrowLeftIcon,
  CalendarIcon,
  ChatIcon,
  FileTextIcon,
  FolderIcon,
  LayerIcon,
  ListIcon,
  PartnersIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ProfileAvatarIcon,
} from "@/components/icons";
import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
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
import { useHasUserToken, useMe } from "@/hooks/auth";
import { avatarColorClass } from "@/lib/avatarColor";
import { PARTNERS_DASHBOARD_HREF } from "@/lib/partners";
import { useMyPartnersStores } from "@/hooks/partners";
import { cn } from "@/lib/utils";

import {
  PartnerNotificationCard,
  PartnerNotificationHeaderButton,
} from "./workspace/PartnerNotifications";

type PartnersMenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  /** 이 경로로 시작하면 활성. */
  activePrefix?: string;
};

/** 소개 — 비회원 · 일반 · 대행사 · 매체사만. 광고주 · 제휴사(콜라보)에겐 보이지 않는다. */
const MENU: PartnersMenuItem[] = [
  {
    key: "home",
    label: "소개",
    Icon: PartnersIcon,
    href: "/partners",
    activePrefix: "/partners",
  },
];

/**
 * 제휴사(콜라보) 회원에게만 — 매장 화면(받은 프로토타입의 탭 구성 + 매장 관리).
 * 매장을 아직 등록하지 않았으면 대시보드만 보인다(대시보드가 매장 등록을 안내).
 */
const PARTNER_MENU: PartnersMenuItem[] = [
  {
    key: "dashboard",
    label: "대시보드",
    Icon: LayerIcon,
    href: PARTNERS_DASHBOARD_HREF,
    activePrefix: PARTNERS_DASHBOARD_HREF,
  },
  {
    key: "collabs",
    label: "콜라보",
    Icon: CalendarIcon,
    href: "/partners/collabs",
    activePrefix: "/partners/collabs",
  },
  {
    key: "history",
    label: "참여 이력",
    Icon: ListIcon,
    href: "/partners/history",
    activePrefix: "/partners/history",
  },
  {
    key: "stores",
    label: "매장 관리",
    Icon: Store,
    href: "/partners/stores",
    activePrefix: "/partners/stores",
  },
  {
    key: "agreement",
    label: "기본협약",
    Icon: FileTextIcon,
    href: "/partners/join/agreement",
    activePrefix: "/partners/join/agreement",
  },
  {
    key: "messages",
    label: "대화",
    Icon: ChatIcon,
    href: "/partners/messages",
    activePrefix: "/partners/messages",
  },
  {
    key: "documents",
    label: "문서함",
    Icon: FolderIcon,
    href: "/partners/documents",
    activePrefix: "/partners/documents",
  },
];

// admix 사이드바(Sidebar.tsx)와 같은 줄 모양 — 38px(곡률 16px), 아이콘 18px.
// 아이콘 가운데는 x=39px 열(접힌 폭 78px의 가운데) — 접고 펼쳐도 아이콘이 제자리에 남는다.
const NAV_ROW =
  "flex h-[38px] w-full items-center gap-[9px] overflow-hidden rounded-[16px] pr-[12px] pl-[20px] transition-colors";

/** 접으면 글자는 바로 투명해지고, 펼치면 서서히 나타난다(admix 사이드바와 같다). 모바일 드로어는 늘 펼친 모양. */
const fadeLabel = (collapsed: boolean) =>
  collapsed
    ? "sm:opacity-0 sm:transition-none"
    : "opacity-100 transition-opacity duration-300";

/**
 * 로고 — 왼쪽 admix 심볼 + 오른쪽 위 글자 로고, 그 밑에 옅은 회색 Collaboration(사이드바 콜라보 메뉴와 같은 HS활공명조).
 * 심볼(36px) 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 11px. 접으면 심볼만 남는다.
 */
function PartnersLogo({
  collapsed = false,
  onNavigate,
  href = "/partners",
}: {
  /** 제휴사는 대시보드로(소개 메뉴가 없다). */
  href?: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-label="admix 콜라보"
      onClick={onNavigate}
      className="flex items-center gap-[10px] overflow-hidden pl-[11px]"
    >
      <Image
        src="/service/symbol.svg"
        alt=""
        width={36}
        height={37}
        priority
        className="h-[36px] w-auto shrink-0"
      />
      <span
        className={cn(
          "flex shrink-0 flex-col items-start gap-[5px]",
          fadeLabel(collapsed),
        )}
      >
        <Image
          src="/service/admix-text-logo.svg"
          alt=""
          width={57}
          height={16}
          priority
          className="h-[16px] w-auto dark:brightness-0 dark:invert"
        />
        <span
          className={cn(
            collabScript.className,
            // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(사이드바 메뉴와 같다).
            "text-[13px] leading-none font-bold tracking-[0.04em] whitespace-nowrap text-gray-400",
          )}
        >
          Collaboration
        </span>
      </span>
    </Link>
  );
}

/**
 * /partners 왼쪽 사이드바 — admix 사이드바와 같은 틀(로고 · 메뉴 · 아래 화면 모드 · 프로필/로그인).
 * PC는 admix와 같은 180px ↔ 78px 접기(접힘 상태도 admix와 같이 쓴다), 모바일은 위 띠의 메뉴 버튼으로 여는 드로어.
 * member — 로그인 쿠키 유무(서버가 넘긴다). 있으면 회원 정보를 받는 동안 로그인 버튼 대신 스피너.
 */
export function PartnersSidebar({ member = false }: { member?: boolean }) {
  const [open, setOpen] = useState(false);
  const collapsed = useLnbCollapsed();
  const pathname = usePathname();
  const { data: me, isError } = useMe();
  const hasToken = useHasUserToken(member);
  const meLoading = hasToken && !me && !isError;
  const displayName = me?.name?.trim() ? me.name : "회원";
  const close = () => setOpen(false);

  const partner = me?.member_category === "partner";
  const stores = useMyPartnersStores();
  // 매장을 등록해야 나머지 메뉴 · 알림이 열린다(불러오는 동안도 대시보드만 — 메뉴가 늘었다 줄지 않게).
  const hasStore = partner && (stores.data?.length ?? 0) > 0;
  const menu: PartnersMenuItem[] = partner
    ? hasStore
      ? PARTNER_MENU
      : PARTNER_MENU.slice(0, 1)
    : me?.member_category === "advertiser"
      ? []
      : MENU;
  // 가장 길게 맞는 경로 하나만 활성 — /partners/dashboard 에서 "소개"(/partners)까지 켜지지 않게.
  // 내 정보(/partners/profile)는 메뉴에 없으니 아무것도 켜지 않는다.
  const activeKey = pathname.startsWith("/partners/profile")
    ? undefined
    : menu
        .filter((m) => m.activePrefix && pathname.startsWith(m.activePrefix))
        .sort((a, b) => b.activePrefix!.length - a.activePrefix!.length)[0]
        ?.key;

  const row = (item: PartnersMenuItem) => {
    const active = item.key === activeKey;
    const { Icon } = item;
    return (
      <li key={item.key}>
        <Link
          href={item.href}
          onClick={close}
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
      {/* 모바일 위 띠 — 메뉴 버튼 + 로고. 누르면 사이드바가 드로어로 열린다. */}
      <div className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center gap-[4px] border-b border-gray-200 bg-surface px-[8px] sm:hidden">
        <Button
          isIconOnly
          variant="ghost"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onPress={() => setOpen(true)}
          className="size-[40px] rounded-[17px]"
        >
          <span aria-hidden className="flex w-[18px] flex-col gap-[4px]">
            <span className="h-[2px] w-full rounded-full bg-current" />
            <span className="h-[2px] w-full rounded-full bg-current" />
            <span className="h-[2px] w-full rounded-full bg-current" />
          </span>
        </Button>
        <div className="-ml-[8px]">
          <PartnersLogo href={partner ? PARTNERS_DASHBOARD_HREF : undefined} />
        </div>
        {hasStore && <PartnerNotificationHeaderButton />}
      </div>

      {/* 모바일 드로어 뒤 어둡게 */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-scrim/30 transition-opacity duration-300 ease-in-out sm:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* 본문 자리(aside) 폭도 nav와 같이 움직여 경계선이 먼저 튀어나오지 않게 한다. */}
      <aside
        className={cn(
          "relative w-0 shrink-0 transition-[width] duration-300 ease-in-out",
          collapsed ? "sm:w-[78px]" : "sm:w-[180px]",
        )}
      >
        <nav
          aria-label="콜라보 사이드바"
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex h-dvh w-[180px] flex-col justify-between border-r border-gray-200 bg-surface p-[10px] transition-[translate,width] duration-300 ease-in-out sm:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
            collapsed && "sm:w-[78px]",
          )}
        >
          {/* 접기/펼치기 — PC에서만, admix와 같이 사이드바 오른쪽 가장자리에 걸쳐 둔다(24px → 곡률 9px). */}
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
              <PartnersLogo
                collapsed={collapsed}
                onNavigate={close}
                href={partner ? PARTNERS_DASHBOARD_HREF : undefined}
              />
            </div>

            <ul className="mt-[30px] flex flex-col gap-[3px]">
              {menu.map(row)}
            </ul>

            {/* admix로 돌아가기 — 소개 메뉴 밑 작은 줄(← + admix 글자 로고). 마우스를 올리면 화살표가 왼쪽으로 움직인다. */}
            <Link
              href="/"
              onClick={close}
              aria-label="admix로 돌아가기"
              title="admix로 돌아가기"
              className={cn(
                // 메뉴보다 한 단계 작은 보조 줄(32px → 곡률 13px). 아이콘 가운데는 메뉴와 같은 x=39px 열.
                "group mt-[8px] flex h-[32px] w-full items-center gap-[8px] overflow-hidden rounded-[13px] pr-[12px] pl-[21px] text-gray-400 transition-colors outline-none hover:text-gray-900 focus-visible:ring-2 focus-visible:ring-primary-200",
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
          </div>

          <div className="pb-[10px]">
            {/* 화면 모드 — admix 사이드바와 같은 보조 줄(32px → 곡률 13px). */}
            <ThemeMenu
              placement={collapsed ? "right bottom" : "top start"}
              className={cn(
                "mb-[12px] flex h-[32px] w-full items-center gap-[9px] overflow-hidden rounded-[13px] text-[13px] font-medium text-gray-500 outline-none transition-[padding,background-color,color] duration-300 ease-in-out hover:bg-gray-50 hover:text-gray-900",
                collapsed ? "px-[13px] sm:pr-0 sm:pl-[20px]" : "px-[13px]",
              )}
              labelClassName={cn("whitespace-nowrap", fadeLabel(collapsed))}
            />
            {/* 알림 — admix "현재 기획안" 카드 자리(로그인 정보 바로 위). 모바일은 위 띠의 종 아이콘. */}
            {hasStore && (
              <div className="mb-[12px] max-sm:hidden">
                <PartnerNotificationCard collapsed={collapsed} />
              </div>
            )}
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
                      onNavigate={close}
                      profileHref="/partners/profile"
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
                  onClick={() => {
                    close();
                    openLoginModal();
                  }}
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
