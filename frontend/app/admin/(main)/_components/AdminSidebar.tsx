"use client";

import {
  Button,
  Chip,
  Disclosure,
  Drawer,
  Link,
  RouterProvider,
  Tabs,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { collabScript } from "@/app/(client)/(main)/_components/collabFont";
import {
  LogOutIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons";
import { useCollabAdminSummary } from "@/hooks/adminCollab";
import {
  adminAuthApi,
  adminAuthKeys,
  isCollabOnlyAdmin,
  useAdminMe,
} from "@/hooks/adminAuth";
import { clearAdminToken, getAdminRefreshToken } from "@/lib/adminToken";
import { cn } from "@/lib/utils";

const MASTER_ACCOUNT_TYPE = "마스터 계정";

// permKey = admin_permission menu_key. "account"(계정 관리)는 마스터 전용.
// badge = 메뉴 옆 숫자(콜라보 "수정 요청" 대기 수).
type NavLink = {
  label: string;
  href: string;
  permKey: string;
  badge?: "requestsPending";
};
/** 접히는 묶음(비즈니스 관리처럼) — 아래 메뉴를 들여 써서 보여 준다. */
type NavGroup = { label: string; links: NavLink[] };

// 사이드바 순서 그대로.
const NAV: (NavLink | NavGroup)[] = [
  { label: "대시보드", href: "/admin", permKey: "dashboard" },
  { label: "광고 매체 관리", href: "/admin/media", permKey: "media" },
  {
    label: "인구 분포 관리",
    links: [
      { label: "인구 분포 데이터", href: "/admin/pop-grid", permKey: "media" },
      { label: "타깃 관리", href: "/admin/pop-targets", permKey: "media" },
    ],
  },
  { label: "회원 관리", href: "/admin/members", permKey: "member" },
  { label: "AI 채팅 관리", href: "/admin/chat", permKey: "chat" },
  {
    label: "비즈니스 관리",
    links: [
      { label: "제안 관리", href: "/admin/proposals", permKey: "business" },
      { label: "문의 관리", href: "/admin/inquiries", permKey: "business" },
    ],
  },
  { label: "FAQ 관리", href: "/admin/faq", permKey: "faq" },
  { label: "계정 관리", href: "/admin/roles", permKey: "account" },
];

/**
 * 콜라보 어드민(/admin/collab) — 같은 로그인으로 위쪽 "admix | 콜라보" 전환에서 들어간다.
 * 제휴사 회원 · 광고주 회원(읽기) · 매장(매체 찾기 "콜라보" 줄도 함께) · 수정 요청 · 콜라보 모집~진행. 권한 "collab".
 */
const COLLAB_HOME = "/admin/collab";
const COLLAB_NAV: NavLink[] = [
  { label: "대시보드", href: COLLAB_HOME, permKey: "collab" },
  { label: "제휴사 회원", href: "/admin/collab/members", permKey: "collab" },
  { label: "광고주 회원", href: "/admin/collab/advertisers", permKey: "collab" },
  { label: "매장 관리", href: "/admin/collab/stores", permKey: "collab" },
  // 매장 유형별 매장 어필 칩 · 조건 메모 값(070).
  {
    label: "매장 항목",
    href: "/admin/collab/store-options",
    permKey: "collab",
  },
  {
    label: "수정 요청",
    href: "/admin/collab/requests",
    permKey: "collab",
    badge: "requestsPending",
  },
  { label: "콜라보", href: "/admin/collab/collabs", permKey: "collab" },
];

const isCollabPath = (pathname: string | null) =>
  !!pathname &&
  (pathname === COLLAB_HOME || pathname.startsWith(`${COLLAB_HOME}/`));

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  // 두 어드민의 첫 화면은 정확히 그 주소일 때만.
  if (href === "/admin" || href === COLLAB_HOME) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 어드민 사이드 메뉴(HeroUI) — PC 는 왼쪽 고정, 모바일은 위 띠 + 왼쪽 Drawer.
 * 메뉴 줄은 HeroUI Link, 접히는 묶음은 Disclosure, admix | 콜라보 전환은 Tabs.
 * RouterProvider 로 감싸 HeroUI Link 가 Next 라우터(router.push)로 이동한다.
 */
export function AdminSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const collabMode = isCollabPath(pathname);

  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      {/* 모바일(<lg): 상단 헤더 + 햄버거 드로어 */}
      <header className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center justify-between border-b border-stroke bg-tone-fafaf9 px-[16px] lg:hidden">
        <Link
          href={collabMode ? COLLAB_HOME : "/admin"}
          aria-label="대시보드"
          className="flex items-center rounded-[8px] no-underline data-[hovered=true]:no-underline"
        >
          <AdminLogo collab={collabMode} compact />
        </Link>
        <Button
          isIconOnly
          variant="ghost"
          aria-label="메뉴 열기"
          onPress={() => setDrawerOpen(true)}
          className="text-tone-364153"
        >
          <MenuIcon className="size-[24px]" />
        </Button>
      </header>

      {/* 모바일 메뉴(HeroUI Drawer, 왼쪽) — 열려 있는 동안 배경 스크롤 잠금 · 바깥 누르기 · Esc 로 닫기는 Drawer 가 맡는다. */}
      <Drawer isOpen={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Backdrop className="lg:hidden">
          <Drawer.Content placement="left">
            <Drawer.Dialog
              aria-label="메뉴"
              className="w-[280px] gap-0 bg-tone-fafaf9 p-0 sm:w-[280px]"
            >
              <div className="flex items-center justify-between px-[20px] py-[16px]">
                <AdminLogo collab={collabMode} compact />
                <Button
                  isIconOnly
                  variant="ghost"
                  aria-label="메뉴 닫기"
                  onPress={() => setDrawerOpen(false)}
                  className="text-tone-364153"
                >
                  <XIcon className="size-[20px]" />
                </Button>
              </div>
              <AdminNav onNavigate={() => setDrawerOpen(false)} />
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer>

      {/* 데스크톱(lg+): 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col bg-tone-fafaf9 lg:flex">
        <div className="flex items-center justify-center p-[32px] pb-[20px]">
          <AdminLogo collab={collabMode} center />
        </div>
        <AdminNav />
      </aside>
    </RouterProvider>
  );
}

/**
 * 사이드바 로고 — admix-logo.svg(심볼 + 글자 로고, 11-10 사용자).
 * 콜라보 어드민이면 밑에 옅은 회색 "Collaboration"(HS활공명조) — 제휴사 화면(/partners) 로고와 같은 글꼴 · 모양.
 * compact — 모바일 위 띠 · 메뉴 서랍: 로고 22px · Collaboration 11px, 왼쪽 정렬. center — PC 사이드바: 가운데 정렬.
 */
function AdminLogo({
  collab,
  compact = false,
  center = false,
}: {
  collab: boolean;
  compact?: boolean;
  center?: boolean;
}) {
  return (
    <span
      className={cn(
        "flex flex-col",
        center ? "items-center" : "items-start",
        compact ? "gap-[3px]" : "gap-[7px]",
      )}
    >
      <Image
        src="/service/admix-logo.svg"
        alt="admix"
        width={1333}
        height={381}
        priority
        className={cn("w-auto", compact ? "h-[22px]" : "h-[28px]")}
      />
      {collab && (
        <span
          className={cn(
            collabScript.className,
            // 글꼴 파일이 Regular 하나뿐이라 font-bold 는 브라우저가 굵게 만들어 그린다(제휴사 로고와 같다).
            "leading-none font-bold tracking-[0.04em] whitespace-nowrap text-gray-400",
            compact ? "text-[11px]" : "text-[13px]",
          )}
        >
          Collaboration
        </span>
      )}
    </span>
  );
}

/**
 * admix | 콜라보 전환 — 같은 로그인, 메뉴만 바뀐다. 콜라보 권한이 없으면 숨긴다.
 * 콜라보 권한만 있는 관리자도 숨긴다 — admix 쪽은 보이지 않고 콜라보 어드민만 쓴다(11-10 사용자, AdminAccessGate).
 */
function ModeSwitch({
  collabMode,
  onNavigate,
}: {
  collabMode: boolean;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <Tabs
      className="mx-[20px]"
      selectedKey={collabMode ? "collab" : "admix"}
      onSelectionChange={(key) => {
        const toCollab = key === "collab";
        if (toCollab === collabMode) return;
        router.push(toCollab ? COLLAB_HOME : "/admin");
        onNavigate?.();
      }}
    >
      <Tabs.ListContainer>
        <Tabs.List aria-label="어드민 전환" className="w-full">
          <Tabs.Tab id="admix" className="flex-1 font-semibold">
            admix
            <Tabs.Indicator />
          </Tabs.Tab>
          <Tabs.Tab id="collab" className="flex-1 font-semibold">
            콜라보
            <Tabs.Indicator />
          </Tabs.Tab>
        </Tabs.List>
      </Tabs.ListContainer>
    </Tabs>
  );
}

/** 메뉴 한 줄(HeroUI Link) — 고른 메뉴는 보라 바탕 · 흰 글자, 나머지는 마우스를 올리면 옅은 회색. */
function NavRow({
  href,
  active,
  onNavigate,
  sub = false,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate?: () => void;
  /** 묶음 안 아래 메뉴 — 들여 쓰고 한 단계 작게. */
  sub?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onPress={onNavigate}
      // next/link 처럼 미리 받아 두기 — 올려 두면 화면을 먼저 받아 이동이 빠르다.
      onHoverStart={() => router.prefetch(href)}
      className={cn(
        "flex w-full items-center rounded-[8px] no-underline data-[hovered=true]:no-underline data-[pressed=true]:no-underline",
        sub
          ? "py-[10px] pl-[36px] pr-[20px] text-sm leading-[20px]"
          : "px-[20px] py-[12px] text-base font-semibold leading-[24px]",
        active
          ? sub
            ? "font-semibold text-primary"
            : "bg-primary text-white"
          : sub
            ? "font-medium text-tone-4a5565 data-[hovered=true]:bg-gray-100"
            : "text-tone-364153 data-[hovered=true]:bg-gray-100",
      )}
    >
      {children}
    </Link>
  );
}

function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useAdminMe();
  const isMaster = me?.account_type === MASTER_ACCOUNT_TYPE;
  const perms = me?.permissions ?? [];
  // 대시보드는 로그인 기본 페이지라 항상 노출. 마스터는 전체 노출.
  // 그 외는 권한 보유 시 노출("account"=계정 관리 포함).
  const canSee = (permKey: string) => {
    if (permKey === "dashboard") return true;
    if (isMaster) return true;
    return perms.includes(permKey);
  };
  const canCollab = !!me && canSee("collab");
  const collabOnly = isCollabOnlyAdmin(me);
  const collabMode = isCollabPath(pathname);
  const { data: summary } = useCollabAdminSummary(canCollab);
  const badgeOf = (link: NavLink) =>
    link.badge === "requestsPending" ? (summary?.requestsPending ?? 0) : 0;
  const handleLogout = () => {
    const refreshToken = getAdminRefreshToken();
    if (refreshToken) {
      void adminAuthApi.logout(refreshToken).catch(() => undefined);
    }
    clearAdminToken();
    queryClient.removeQueries({ queryKey: adminAuthKeys.all });
    router.replace("/admin/login");
    router.refresh();
  };

  return (
    <>
      {canCollab && !collabOnly && (
        <ModeSwitch collabMode={collabMode} onNavigate={onNavigate} />
      )}
      {collabMode ? (
        <nav className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[16px]">
          {COLLAB_NAV.filter((link) => canSee(link.permKey)).map((link) => {
            const count = badgeOf(link);
            const active = isActive(pathname, link.href);
            return (
              <NavRow
                key={link.href}
                href={link.href}
                active={active}
                onNavigate={onNavigate}
              >
                <span className="flex-1">{link.label}</span>
                {count > 0 && (
                  // 대기 수 칩 — 고른 메뉴(보라 바탕) 위에서는 흰 칩으로 뒤집는다.
                  <Chip
                    size="sm"
                    variant="primary"
                    color="accent"
                    aria-label={`대기 ${count}건`}
                    className={cn(
                      "min-w-[22px] justify-center font-semibold",
                      active && "bg-white text-primary",
                    )}
                  >
                    {count}
                  </Chip>
                )}
              </NavRow>
            );
          })}
        </nav>
      ) : (
        <nav className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[16px]">
          {NAV.map((item) => {
            if ("href" in item) {
              if (!canSee(item.permKey)) return null;
              return (
                <NavRow
                  key={item.href}
                  href={item.href}
                  active={isActive(pathname, item.href)}
                  onNavigate={onNavigate}
                >
                  {item.label}
                </NavRow>
              );
            }
            const links = item.links.filter((link) => canSee(link.permKey));
            if (!links.length) return null;
            return (
              <NavGroupItem
                key={item.label}
                label={item.label}
                links={links}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            );
          })}
        </nav>
      )}

      <div className="p-[20px]">
        {/* 메뉴 줄과 같은 자리 · 크기(왼쪽 정렬, 높이 48px). */}
        <Button
          variant="ghost"
          fullWidth
          onPress={handleLogout}
          className="h-[48px] justify-start gap-[10px] rounded-[8px] px-[20px] text-base leading-[24px] text-tone-364153"
        >
          <LogOutIcon className="size-[20px] shrink-0" />
          로그아웃
        </Button>
      </div>
    </>
  );
}

/** 접히는 묶음(HeroUI Disclosure) — 처음엔 펼쳐 두고, 묶음 안 메뉴를 보고 있으면 묶음 이름도 보라. */
function NavGroupItem({
  label,
  links,
  pathname,
  onNavigate,
}: {
  label: string;
  links: NavLink[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  const groupActive = links.some((link) => isActive(pathname, link.href));

  return (
    <Disclosure defaultExpanded>
      <Disclosure.Heading>
        <Disclosure.Trigger
          className={cn(
            "flex h-[48px] w-full items-center rounded-[8px] px-[20px] text-left text-base font-semibold leading-[24px] transition-colors data-[hovered=true]:bg-gray-100",
            groupActive ? "text-primary" : "text-tone-364153",
          )}
        >
          <span className="flex-1">{label}</span>
          <Disclosure.Indicator className="size-[20px]" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-[6px] p-0 pt-[6px]">
          {links.map((link) => (
            <NavRow
              key={link.href}
              href={link.href}
              active={isActive(pathname, link.href)}
              onNavigate={onNavigate}
              sub
            >
              {link.label}
            </NavRow>
          ))}
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
