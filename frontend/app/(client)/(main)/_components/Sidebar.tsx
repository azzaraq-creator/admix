"use client";

import { Button, Dropdown, Separator, Spinner } from "@heroui/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ComponentType, type SVGProps } from "react";

import {
  ChatIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CollectionIcon,
  FileTextIcon,
  LocationIcon,
  LoginDoorIcon,
  LogoFullDark,
  LogoutFilledIcon,
  LoveIcon,
  MixieIcon,
  ProfileAvatarIcon,
  ProfileFilledIcon,
} from "@/components/icons";
import { useLogout, useMe } from "@/hooks/auth";
import { avatarColorClass } from "@/lib/avatarColor";
import { cn } from "@/lib/utils";

import { CurrentProposalButton } from "./CurrentProposalButton";
import {
  setLnbCollapsed,
  setLnbExpanded,
  useLnbCollapsed,
  useLnbExpanded,
} from "./useLnb";
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

// 프로필 메뉴 아이콘 — 글자보다 한 톤 옅게 둬 글자가 먼저 읽히게 한다.
const MENU_ICON = "size-[16px] shrink-0 text-black-500";

// 접고 펼칠 때 아무것도 좌우로 움직이지 않게, 아이콘·로고 심볼·아바타의 가운데를 모두
// x=39px 열에 맞춘다. 접힌 폭 78px의 정가운데가 39px이라 접혀도 제자리에 남는다.
// (nav 여백 10px + 행 왼쪽 여백 20px + 아이콘 18px의 절반 9px = 39px)
const NAV_ROW =
  "flex h-[38px] w-full items-center gap-[9px] overflow-hidden rounded-[16px] pr-[12px] pl-[20px] transition-colors";

/**
 * 접으면 글자는 바로 투명해지고, 펼치면 폭이 커지는 동안 서서히 나타난다.
 * 넘치는 부분은 행(overflow-hidden)이 잘라서 좁은 사이드바 밖으로 삐져나오지 않는다.
 * 모바일 드로어는 늘 펼친 모양이라 sm: 에만 건다.
 */
const fadeLabel = (collapsed: boolean) =>
  collapsed
    ? "sm:opacity-0 sm:transition-none"
    : "opacity-100 transition-opacity duration-300";

/**
 * member — 로그인 쿠키가 있는지(서버가 넘긴다). 있으면 회원 정보를 받는 동안 로그인 버튼 대신
 * 불러오는 중 표시를 둔다(새로고침 때 "로그인 / 회원가입"이 잠깐 보였다 바뀌지 않게).
 */
export function Sidebar({ member = false }: { member?: boolean }) {
  const expanded = useLnbExpanded();
  // 데스크톱 접힘(180px → 78px). 모바일 드로어에는 적용하지 않도록 모든 변화는 sm: 에만 건다.
  const collapsed = useLnbCollapsed();
  const pathname = usePathname();
  const router = useRouter();

  const { panelOpen, setPanelOpen } = useMixieChat();

  const { data: me, isError: meError } = useMe();
  const meLoading = member && !me && !meError;

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
      {/* 드로어와 함께 서서히 나타나고 사라지도록 늘 그려 두고, 닫혀 있을 땐 클릭을 통과시킨다. */}
      <div
        aria-hidden
        onClick={() => setLnbExpanded(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 ease-in-out sm:hidden",
          expanded ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      {/* 본문 자리(aside) 폭도 nav와 같이 움직여야 경계선이 먼저 튀어나오지 않는다.
          (지도처럼 크기 변화에 무거운 본문은 쪽에서 재배치를 묶어 처리한다 — useKakaoMap 참고.) */}
      <aside
        className={cn(
          "relative w-0 shrink-0 transition-[width] duration-300 ease-in-out",
          collapsed ? "sm:w-[78px]" : "sm:w-[180px]",
        )}
      >
        <nav
          aria-label="사이드바"
          className={cn(
            "absolute inset-y-0 left-0 z-40 flex h-dvh w-[180px] flex-col justify-between border-r border-black-200 bg-white p-[10px] transition-[translate,width] duration-300 ease-in-out sm:translate-x-0",
            expanded ? "translate-x-0" : "-translate-x-full",
            collapsed && "sm:w-[78px]",
          )}
        >
          {/* 접기/펼치기 — 데스크톱에서만. 사이드바 오른쪽 가장자리에 걸쳐 둔다.
              버튼 24px → 곡률 (24/2)-3 = 9px. */}
          <Button
            isIconOnly
            variant="ghost"
            aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
            aria-expanded={!collapsed}
            onPress={() => setLnbCollapsed(!collapsed)}
            className="absolute top-[28px] -right-[12px] hidden size-[24px] min-w-0 rounded-[9px] border border-black-200 bg-white p-0 text-black-500 shadow-[0_2px_6px_rgba(0,0,0,0.08)] data-[hovered=true]:bg-black-50 data-[hovered=true]:text-black-900 sm:flex"
          >
            <ChevronLeftIcon
              className={cn(
                "size-[14px] transition-transform duration-300",
                collapsed && "rotate-180",
              )}
            />
          </Button>

          <div className="flex flex-col">
            <Link
              href="/"
              aria-label="홈"
              onClick={handleNavClick}
              // 로고 심볼(약 26px)의 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 16px.
              // 모바일 드로어는 로고를 20px로 줄이므로 심볼 폭도 20px → 왼쪽 여백 19px.
              className="mt-[15px] flex h-[26px] items-center justify-start pl-[16px] max-sm:h-[20px] max-sm:pl-[19px]"
            >
              {/* 접으면 심볼 폭(26px)만 남기고 글자 부분을 잘라 낸다. 폭이 함께 움직여
                  펼칠 때 글자가 먼저 튀어나오지 않는다. */}
              <span
                className={cn(
                  "block overflow-hidden transition-[width] duration-300 ease-in-out",
                  collapsed ? "w-[70px] sm:w-[26px]" : "w-[70px] sm:w-[91px]",
                )}
              >
                <LogoFullDark className="h-[20px] sm:h-[26px]" />
              </span>
            </Link>

            <ul className="mt-[16px] flex flex-col sm:mt-[30px]">
              <li>
                {/* 페이지 이동 대신 대화 패널을 여닫는다 — 어느 화면에서든 같은 대화를
                    이어 볼 수 있다. 글자는 현재 위치와 무관하게 늘 그라데이션으로 둔다. */}
                <button
                  type="button"
                  // 패널의 바깥 클릭 닫기에서 제외(이 버튼은 스스로 여닫는다).
                  data-mixie-toggle
                  aria-expanded={panelOpen}
                  aria-label="AI 믹시"
                  title={collapsed ? "AI 믹시" : undefined}
                  onClick={() => {
                    setPanelOpen(!panelOpen);
                    handleNavClick();
                  }}
                  // 열려 있을 땐 다른 메뉴의 활성 표시(연보라 배경)와 겹치지 않도록
                  // 보라 그라데이션으로 채우고 글자·아이콘을 흰색으로 뒤집어 눈에 띄게 한다.
                  // 모바일은 누르면 드로어가 닫히고 패널이 화면 전체를 덮어 이 표시가 보이지 않으므로
                  // (닫히는 동안 잠깐 번쩍일 뿐이라) sm: 에만 건다.
                  className={cn(
                    NAV_ROW,
                    panelOpen
                      ? "max-sm:hover:bg-[#f7f3fe] sm:bg-gradient-to-r sm:from-primary-500 sm:to-primary-700 sm:shadow-[0_4px_12px_0_rgba(163,59,209,0.35)]"
                      : "hover:bg-[#f7f3fe]",
                  )}
                >
                  {/* 아이콘의 그라데이션 fill은 속성값이라 CSS fill로 덮어 흰색으로 바꾼다. */}
                  <MixieIcon
                    className={`size-[18px] shrink-0 ${panelOpen ? "sm:[&_path]:fill-white" : ""}`}
                  />
                  <span
                    className={cn(
                      "text-sm font-semibold whitespace-nowrap",
                      "bg-gradient-to-r from-primary-300 to-primary-800 bg-clip-text text-transparent",
                      panelOpen && "sm:bg-none sm:text-white",
                      fadeLabel(collapsed),
                    )}
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
                      // 접히면 글자가 숨으므로 이름은 aria-label로, 마우스를 올리면 title로 알린다.
                      aria-label={label}
                      title={collapsed ? label : undefined}
                      className={cn(
                        NAV_ROW,
                        active
                          ? "bg-primary-100 font-bold text-primary"
                          : "font-medium text-black-900 hover:bg-[#f7f3fe]",
                      )}
                    >
                      {/* 아이콘은 fill="currentColor"라 행의 글자색을 그대로 따른다. */}
                      <Icon className="size-[18px] shrink-0" />
                      <span
                        className={cn(
                          "text-sm whitespace-nowrap",
                          fadeLabel(collapsed),
                        )}
                      >
                        {label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="pb-[10px]">
            {/* 담는 제안서 요약 카드 — 로그인 정보 바로 위. 모바일은 헤더 오른쪽 버튼을 쓴다. */}
            <div className="mb-[12px] max-sm:hidden">
              <CurrentProposalButton variant="sidebar" collapsed={collapsed} />
            </div>
            {meLoading ? (
              // 회원 정보 불러오는 중 — 프로필 줄과 같은 높이(24px)에 아바타 자리 스피너.
              <div
                role="status"
                aria-label="회원 정보를 불러오는 중"
                className="flex h-[24px] items-center pl-[17px]"
              >
                <Spinner size="sm" />
              </div>
            ) : me ? (
              // 아바타(24px)의 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 17px.
              <div className="pr-[10px] pl-[17px]">
                {/* 프로필 메뉴 — HeroUI Dropdown(react-aria Menu). 바깥 클릭·Esc 닫기, 방향키 이동을
                    기본으로 지원한다. 메뉴 폭은 트리거(LNB 안쪽 폭)에 맞추고 위로 연다. */}
                <Dropdown>
                  <Dropdown.Trigger
                    aria-label="프로필 메뉴"
                    className="flex w-full items-center gap-[10px] overflow-hidden rounded-[10px] outline-none data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-primary-200"
                  >
                    <ProfileAvatarIcon
                      className={cn(
                        "size-[24px] shrink-0",
                        avatarColorClass(me?.sns_provider),
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
                        <ProfileFilledIcon className={MENU_ICON} />
                        <span className="text-sm font-medium text-black">
                          내 정보
                        </span>
                      </Dropdown.Item>
                      <Dropdown.Item id="/help" textValue="약관 및 정책">
                        <FileTextIcon className={`${MENU_ICON} size-[14px]`} />
                        <span className="text-sm font-medium text-black">
                          약관 및 정책
                        </span>
                      </Dropdown.Item>
                      {/* 이동 메뉴와 로그아웃을 구분선으로 떼고, 로그아웃은 위험 동작이라 붉게 둔다. */}
                      <Separator className="my-[4px] bg-black-200" />
                      <Dropdown.Item
                        id="logout"
                        textValue="로그아웃"
                        variant="danger"
                        className="text-danger"
                      >
                        <LogoutFilledIcon className="size-[14px] shrink-0 opacity-80" />
                        <span className="text-sm font-medium">로그아웃</span>
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
                // 배지(32px)의 가운데를 아이콘 열(x=39px)에 맞춘다 → 왼쪽 여백 13px.
                // 오른쪽 7px로 줄여 라벨(96px) 자리는 그대로 확보한다.
                className="h-auto justify-start gap-[8px] overflow-hidden rounded-2xl py-2.5 pr-[7px] pl-[13px] data-[hovered=true]:border-primary-200"
              >
                {/* 배지 높이 32px → (32/2)-3 = 13px */}
                <span className="flex size-8 shrink-0 items-center justify-center rounded-[13px] bg-primary-100 text-primary">
                  <LoginDoorIcon className="h-[15px] w-[13px]" />
                </span>
                <span
                  className={cn(
                    "text-sm font-medium whitespace-nowrap text-foreground",
                    fadeLabel(collapsed),
                  )}
                >
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
