"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useState,
  type ComponentType,
  type MouseEvent,
  type SVGProps,
} from "react";

import {
  AirplayIcon,
  BusIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  ColumnsToggleIcon,
  FolderIcon,
  HeadsetIcon,
  Logo,
  LogInIcon,
  LogOutIcon,
  MapIcon,
  UserIcon,
} from "@/components/icons";
import { useLogout, useMe } from "@/hooks/auth";

import { setLnbExpanded, useLnbExpanded } from "./useLnb";
import { openLoginModal } from "./useLoginModal";

type MenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
};

const MENU_ITEMS: MenuItem[] = [
  { key: "fixed", label: "고정 매체", Icon: MapIcon, href: "/fixed" },
  { key: "moving", label: "이동·지역 매체", Icon: BusIcon, href: "/moving" },
  { key: "service", label: "서비스 소개", Icon: AirplayIcon, href: "/service" },
  {
    key: "proposals",
    label: "내 제안서",
    Icon: FolderIcon,
    href: "/proposals",
  },
  { key: "contact", label: "문의하기", Icon: HeadsetIcon, href: "/contact" },
];

function LnbTooltip({ label, expanded }: { label: string; expanded: boolean }) {
  if (expanded) return null;
  return (
    <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-[16px] hidden -translate-y-1/2 whitespace-nowrap rounded-[8px] bg-white px-[12px] py-[4px] text-base font-medium leading-[24px] text-black drop-shadow-[0px_0px_2px_rgba(0,0,0,0.25)] [@media(hover:hover)]:group-hover:block">
      {label}
    </span>
  );
}

const SIDEBAR_ROW_BASE =
  "flex w-full items-center gap-[6px] rounded-[8px] p-[12px] text-black transition-colors";

const sidebarRowClass = (active: boolean) =>
  `${SIDEBAR_ROW_BASE} ${active ? "bg-platinum-100" : "hover:bg-platinum-50"}`;

const sidebarLabelClass = (expanded: boolean) =>
  `pointer-events-none text-sm font-medium whitespace-nowrap transition-opacity duration-200 ${
    expanded ? "opacity-100" : "opacity-0"
  }`;

function SidebarNavRow({
  href,
  label,
  Icon,
  active,
  expanded,
  onClick,
}: {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  active: boolean;
  expanded: boolean;
  onClick: (event: MouseEvent) => void;
}) {
  return (
    <>
      <Link
        href={href}
        aria-label={label}
        onClick={onClick}
        className={sidebarRowClass(active)}
      >
        <Icon className="size-[24px] shrink-0" />
        <span className={sidebarLabelClass(expanded)}>{label}</span>
      </Link>
      <LnbTooltip label={label} expanded={expanded} />
    </>
  );
}

export function Sidebar() {
  const expanded = useLnbExpanded();
  const pathname = usePathname();
  const isHelp = pathname?.startsWith("/help") ?? false;

  const { data: me } = useMe();
  const [profileOpen, setProfileOpen] = useState(false);

  const setOpen = setLnbExpanded;

  const logout = useLogout();
  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
  };

  const displayName = me?.name?.trim() ? me.name : "회원";
  const stop = (event: MouseEvent) => event.stopPropagation();
  const handleNavClick = (event: MouseEvent) => {
    event.stopPropagation();
    if (window.innerWidth < 640) setOpen(false);
  };

  return (
    <>
      {expanded && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
        />
      )}
      <aside
        className={`relative shrink-0 transition-[width] duration-300 ease-in-out ${
          expanded ? "w-0 sm:w-[224px]" : "w-0 sm:w-[64px]"
        }`}
      >
        <nav
          aria-label="사이드바"
          onClick={() => setOpen(!expanded)}
          className={`absolute inset-y-0 left-0 z-40 flex h-dvh cursor-pointer flex-col justify-between border-r border-stroke bg-white px-[8px] py-[24px] transition-[width,transform] duration-300 ease-in-out ${
            expanded
              ? "w-[224px] translate-x-0"
              : "w-[64px] -translate-x-full sm:translate-x-0"
          }`}
        >
          {expanded ? (
            <div className="flex w-full items-center justify-between">
              <Link
                href="/"
                aria-label="홈"
                onClick={handleNavClick}
                className="flex items-center justify-center rounded-[8px] p-[12px] transition-colors hover:bg-platinum-50"
              >
                <Logo className="size-[24px]" />
              </Link>
              <button
                type="button"
                aria-label="사이드바 접기"
                onClick={(event) => {
                  stop(event);
                  setOpen(false);
                }}
                className="flex items-center justify-center rounded-[8px] p-[12px] text-black transition-colors hover:bg-platinum-50"
              >
                <ColumnsToggleIcon className="size-[24px]" />
              </button>
            </div>
          ) : (
            <Link
              href="/"
              aria-label="홈"
              onClick={handleNavClick}
              className="flex w-full items-center justify-center rounded-[8px] p-[12px] transition-colors hover:bg-platinum-50"
            >
              <Logo className="size-[24px]" />
            </Link>
          )}

          <ul className="flex w-full flex-col gap-[12px]">
            {MENU_ITEMS.map(({ key, label, Icon, href }) => (
              <li key={key} className="group relative">
                <SidebarNavRow
                  href={href}
                  label={label}
                  Icon={Icon}
                  active={pathname?.startsWith(href) ?? false}
                  expanded={expanded}
                  onClick={handleNavClick}
                />
              </li>
            ))}
          </ul>

          <div className="flex w-full flex-col gap-[12px]">
            {!me && (
              <div className="group relative">
                <SidebarNavRow
                  href="/help"
                  label="도움말"
                  Icon={CircleAlertIcon}
                  active={isHelp}
                  expanded={expanded}
                  onClick={handleNavClick}
                />
              </div>
            )}
            {me ? (
              <div className="group relative">
                {profileOpen && expanded && (
                  <>
                    <div
                      aria-hidden
                      onClick={(event) => {
                        stop(event);
                        setProfileOpen(false);
                      }}
                      className="fixed inset-0 z-30"
                    />
                    <div className="absolute bottom-full left-0 z-40 mb-[4px] flex w-full flex-col gap-[4px] rounded-[8px] bg-white px-[12px] py-[4px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.25)]">
                      <Link
                        href="/profile"
                        onClick={handleNavClick}
                        className="flex items-center justify-between border-b-[0.917px] border-stroke px-[6px] py-[12px]"
                      >
                        <span className="flex items-center gap-[6px]">
                          <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-primary">
                            <UserIcon className="size-[14px] text-white" />
                          </span>
                          <span className="text-base font-medium leading-[24px] text-black">
                            {displayName}
                          </span>
                        </span>
                        <ChevronRightIcon className="size-[16px] shrink-0 text-black" />
                      </Link>
                      <Link
                        href="/help"
                        onClick={handleNavClick}
                        className="flex items-center gap-[6px] px-[6px] py-[12px]"
                      >
                        <CircleAlertIcon className="size-[20px] shrink-0 text-black" />
                        <span className="text-base font-medium leading-[24px] text-black">
                          도움말
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(event) => {
                          stop(event);
                          handleLogout();
                        }}
                        className="flex items-center gap-[6px] px-[6px] py-[12px]"
                      >
                        <LogOutIcon className="size-[20px] shrink-0 text-black" />
                        <span className="text-base font-medium leading-[24px] text-black">
                          로그아웃
                        </span>
                      </button>
                    </div>
                  </>
                )}
                <button
                  type="button"
                  aria-label="프로필 메뉴"
                  onClick={(event) => {
                    stop(event);
                    if (!expanded) {
                      setOpen(true);
                      return;
                    }
                    setProfileOpen((value) => !value);
                  }}
                  className={`${SIDEBAR_ROW_BASE} hover:bg-platinum-50`}
                >
                  <span className="flex size-[24px] shrink-0 items-center justify-center rounded-full bg-primary">
                    <UserIcon className="size-[14px] text-white" />
                  </span>
                  <span
                    className={`pointer-events-none whitespace-nowrap text-base font-medium text-black ${
                      expanded ? "opacity-100" : "hidden"
                    }`}
                  >
                    {displayName}
                  </span>
                </button>
                <LnbTooltip label={displayName} expanded={expanded} />
              </div>
            ) : (
              <button
                type="button"
                aria-label="로그인 / 회원가입"
                onClick={(event) => {
                  stop(event);
                  openLoginModal();
                }}
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] bg-primary p-[12px] text-white transition-colors hover:bg-primary-800 active:bg-primary-900"
              >
                <LogInIcon className="size-[24px] shrink-0" />
                <span
                  className={`pointer-events-none text-base font-medium whitespace-nowrap ${
                    expanded ? "opacity-100" : "hidden"
                  }`}
                >
                  로그인 / 회원가입
                </span>
              </button>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
