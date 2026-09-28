"use client";

import { Button, Dropdown } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type SVGProps } from "react";

import {
  ChatIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  CollectionIcon,
  LocationIcon,
  LoginDoorIcon,
  LogoFullDark,
  LogOutIcon,
  LoveIcon,
  MixieIcon,
  ProfileAvatarIcon,
  UserIcon,
} from "@/components/icons";
import { useLogout, useMe } from "@/hooks/auth";

import { setLnbExpanded, useLnbExpanded } from "./useLnb";
import { openLoginModal } from "./useLoginModal";
import { useMixieChat } from "./useMixieChat";

type MenuItem = {
  key: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
  /** href 외에 이 메뉴가 활성으로 잡아야 할 경로들 */
  alsoActiveOn?: string[];
};

// Figma "01. 대시보드 - 배경 없음 (AI 믹시)" 기준 메뉴 구성.
// AI 믹시(홈)는 활성 스타일이 달라 MENU_ITEMS와 분리해 렌더한다.
const MENU_ITEMS: MenuItem[] = [
  {
    key: "fixed",
    label: "매체 찾기",
    Icon: LocationIcon,
    href: "/fixed",
    // 고정 매체(/fixed)와 이동·지역 매체(/moving)를 합친 메뉴.
    alsoActiveOn: ["/moving"],
  },
  {
    key: "proposals",
    label: "제안서",
    Icon: CollectionIcon,
    href: "/proposals",
  },
  {
    key: "favorites",
    label: "관심 매체",
    Icon: LoveIcon,
    href: "/favorites",
  },
  {
    key: "contact",
    label: "문의하기",
    Icon: ChatIcon,
    href: "/contact",
  },
];

const NAV_ROW =
  "flex h-[38px] w-full items-center gap-[9px] rounded-[16px] pr-[12px] pl-[20px] transition-colors";

export function Sidebar() {
  const expanded = useLnbExpanded();
  const pathname = usePathname();
  const router = useRouter();

  const { panelOpen, setPanelOpen } = useMixieChat();

  const { data: me } = useMe();

  const logout = useLogout();
  const handleLogout = async () => {
    await logout();
  };

  const displayName = me?.name?.trim() ? me.name : "회원";
  // 모바일에서는 드로어로 열리므로, 이동 시 닫아준다.
  const handleNavClick = () => {
    if (window.innerWidth < 640) setLnbExpanded(false);
  };

  return (
    <>
      {expanded && (
        <div
          aria-hidden
          onClick={() => setLnbExpanded(false)}
          className="fixed inset-0 z-40 bg-black/30 sm:hidden"
        />
      )}
      <aside className="relative w-0 shrink-0 sm:w-[180px]">
        <nav
          aria-label="사이드바"
          className={`absolute inset-y-0 left-0 z-40 flex h-dvh w-[180px] flex-col justify-between border-r border-black-200 bg-white p-[10px] transition-transform duration-300 ease-in-out sm:translate-x-0 ${
            expanded ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex flex-col">
            <Link
              href="/"
              aria-label="홈"
              onClick={handleNavClick}
              // 메뉴 행(NAV_ROW)의 pl-[20px]에 맞춰 로고 왼쪽 끝을 아이콘 열과 정렬한다.
              className="mt-[15px] flex items-center justify-start pl-[20px]"
            >
              <LogoFullDark className="h-[26px]" />
            </Link>

            <ul className="mt-[30px] flex flex-col">
              <li>
                {/* 페이지 이동 대신 대화 패널을 여닫는다 — 어느 화면에서든 같은 대화를
                    이어 볼 수 있다. 글자는 현재 위치와 무관하게 늘 그라데이션으로 둔다. */}
                <button
                  type="button"
                  // 패널의 바깥 클릭 닫기에서 제외(이 버튼은 스스로 여닫는다).
                  data-mixie-toggle
                  aria-expanded={panelOpen}
                  onClick={() => {
                    setPanelOpen(!panelOpen);
                    handleNavClick();
                  }}
                  // 열려 있을 땐 다른 메뉴의 활성 표시(연보라 배경)와 겹치지 않도록
                  // 보라 그라데이션으로 채우고 글자·아이콘을 흰색으로 뒤집어 눈에 띄게 한다.
                  className={`${NAV_ROW} ${
                    panelOpen
                      ? "bg-gradient-to-r from-primary-500 to-primary-700 shadow-[0_4px_12px_0_rgba(163,59,209,0.35)]"
                      : "hover:bg-[#f7f3fe]"
                  }`}
                >
                  {/* 아이콘의 그라데이션 fill은 속성값이라 CSS fill로 덮어 흰색으로 바꾼다. */}
                  <MixieIcon
                    className={`size-[18px] shrink-0 ${panelOpen ? "[&_path]:fill-white" : ""}`}
                  />
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${
                      panelOpen
                        ? "text-white"
                        : "bg-gradient-to-r from-primary-300 to-primary-800 bg-clip-text text-transparent"
                    }`}
                  >
                    AI 믹시
                  </span>
                </button>
              </li>
            </ul>

            <hr className="my-[15px] border-t border-black-200" />

            <ul className="flex flex-col gap-[3px]">
              {MENU_ITEMS.map(({ key, label, Icon, href, alsoActiveOn }) => {
                const active = [href, ...(alsoActiveOn ?? [])].some(
                  (path) => pathname?.startsWith(path) ?? false,
                );
                return (
                  <li key={key}>
                    <Link
                      href={href}
                      onClick={handleNavClick}
                      aria-current={active ? "page" : undefined}
                      className={`${NAV_ROW} ${
                        active
                          ? "bg-primary-100 font-bold text-primary"
                          : "font-medium text-black-900 hover:bg-[#f7f3fe]"
                      }`}
                    >
                      {/* 아이콘은 fill="currentColor"라 행의 글자색을 그대로 따른다. */}
                      <Icon className="size-[18px] shrink-0" />
                      <span className="text-sm whitespace-nowrap">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pb-[10px]">
            {me ? (
              <div className="px-[10px]">
                {/* 프로필 메뉴 — HeroUI Dropdown(react-aria Menu). 바깥 클릭·Esc 닫기, 방향키 이동을
                    기본으로 지원한다. 메뉴 폭은 트리거(LNB 안쪽 폭)에 맞추고 위로 연다. */}
                <Dropdown>
                  <Dropdown.Trigger
                    aria-label="프로필 메뉴"
                    className="flex w-full items-center gap-[10px] rounded-[10px] outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary-200"
                  >
                    <ProfileAvatarIcon className="size-[24px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-black">
                      {displayName} 님
                    </span>
                    <ChevronRightIcon className="size-[16px] shrink-0 text-black" />
                  </Dropdown.Trigger>
                  <Dropdown.Popover
                    placement="top start"
                    className="w-(--trigger-width) min-w-[160px]"
                  >
                    <Dropdown.Menu
                      aria-label="프로필 메뉴"
                      onAction={(key) => {
                        if (key === "logout") {
                          void handleLogout();
                          return;
                        }
                        handleNavClick();
                        router.push(String(key));
                      }}
                    >
                      <Dropdown.Item id="/profile" textValue="내 정보">
                        <UserIcon className="size-[16px] shrink-0 text-black" />
                        <span className="text-sm font-medium text-black">
                          내 정보
                        </span>
                      </Dropdown.Item>
                      <Dropdown.Item id="/help" textValue="도움말">
                        <CircleAlertIcon className="size-[16px] shrink-0 text-black" />
                        <span className="text-sm font-medium text-black">
                          도움말
                        </span>
                      </Dropdown.Item>
                      <Dropdown.Item id="logout" textValue="로그아웃">
                        <LogOutIcon className="size-[16px] shrink-0 text-black" />
                        <span className="text-sm font-medium text-black">
                          로그아웃
                        </span>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </div>
            ) : (
              // LNB 폭이 159px뿐이라 라벨(96px)이 잘리지 않게 배지·여백을 줄여 맞춘다.
              <Button
                variant="ghost"
                fullWidth
                aria-label="로그인 / 회원가입"
                onPress={openLoginModal}
                className="h-auto justify-start gap-[8px] rounded-2xl px-[10px] py-2.5 data-[hovered=true]:border-primary-200"
              >
                {/* 배지 높이 32px → (32/2)-3 = 13px */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[13px] bg-primary-100 text-primary">
                  <LoginDoorIcon className="h-[15px] w-[13px]" />
                </span>
                <span className="text-sm font-medium text-foreground">
                  로그인 / 회원가입
                </span>
              </Button>
            )}
          </div>
        </nav>
      </aside>
    </>
  );
}
