"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ChevronDownIcon,
  LogoFull,
  LogOutIcon,
  MenuIcon,
  XIcon,
} from "@/components/icons";
import { adminAuthApi, adminAuthKeys, useAdminMe } from "@/hooks/adminAuth";
import { clearAdminToken, getAdminRefreshToken } from "@/lib/adminToken";

const MASTER_ACCOUNT_TYPE = "마스터 계정";

// permKey = admin_permission menu_key. "account"(계정 관리)는 마스터 전용.
type NavLink = { label: string; href: string; permKey: string };
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

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 모바일 드로어 — 열려 있는 동안 배경 스크롤 잠금 + ESC 닫기.
  useEffect(() => {
    if (!drawerOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  return (
    <>
      {/* 모바일(<lg): 상단 헤더 + 햄버거 드로어 */}
      <header className="sticky top-0 z-30 flex h-[56px] shrink-0 items-center justify-between border-b border-stroke bg-tone-fafaf9 px-[16px] lg:hidden">
        <Link href="/admin" aria-label="대시보드">
          <LogoFull />
        </Link>
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => setDrawerOpen(true)}
          className="flex size-[40px] items-center justify-center rounded-[8px] text-tone-364153 hover:bg-gray-100"
        >
          <MenuIcon className="size-[24px]" />
        </button>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-scrim/40"
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-tone-fafaf9 shadow-xl">
            <div className="flex items-center justify-between px-[20px] py-[16px]">
              <LogoFull />
              <button
                type="button"
                aria-label="메뉴 닫기"
                onClick={() => setDrawerOpen(false)}
                className="flex size-[40px] items-center justify-center rounded-[8px] text-tone-364153 hover:bg-gray-100"
              >
                <XIcon className="size-[20px]" />
              </button>
            </div>
            <AdminNav onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* 데스크톱(lg+): 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col bg-tone-fafaf9 lg:flex">
        <div className="flex items-center justify-center p-[32px]">
          <LogoFull />
        </div>
        <AdminNav />
      </aside>
    </>
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
  const topClass = (active: boolean) =>
    `flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
      active ? "bg-primary text-white" : "text-tone-364153 hover:bg-gray-100"
    }`;

  return (
    <>
      <nav className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[16px]">
        {NAV.map((item) => {
          if ("href" in item) {
            if (!canSee(item.permKey)) return null;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={topClass(isActive(pathname, item.href))}
              >
                {item.label}
              </Link>
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

      <div className="p-[20px]">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-[10px] rounded-[8px] px-[20px] py-[12px] text-base font-medium leading-[24px] text-tone-364153 hover:bg-gray-100"
        >
          <LogOutIcon className="size-[20px] shrink-0" />
          로그아웃
        </button>
      </div>
    </>
  );
}

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
  const [open, setOpen] = useState(true);
  const groupActive = links.some((link) => isActive(pathname, link.href));

  return (
    <div className="flex flex-col gap-[6px]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
          groupActive ? "text-primary" : "text-tone-364153"
        } hover:bg-gray-100`}
      >
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon
          className={`size-[24px] shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-[6px]">
          {links.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onNavigate}
                className={`flex items-center rounded-[8px] py-[10px] pl-[36px] pr-[20px] text-sm leading-[20px] ${
                  active
                    ? "font-semibold text-primary"
                    : "font-medium text-tone-4a5565 hover:bg-gray-100"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
