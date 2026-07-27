"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ChevronDownIcon, LogoFull, LogOutIcon } from "@/components/icons";
import { useAdminMe } from "@/hooks/adminAuth";
import { clearAdminToken } from "@/lib/adminToken";

const MASTER_ACCOUNT_TYPE = "마스터 계정";

// permKey = admin_permission menu_key. "account"(계정 관리)는 마스터 전용.
type NavLink = { label: string; href: string; permKey: string };

const TOP_LINKS: NavLink[] = [
  { label: "대시보드", href: "/admin", permKey: "dashboard" },
  { label: "광고 매체 관리", href: "/admin/media", permKey: "media" },
  { label: "회원 관리", href: "/admin/members", permKey: "member" },
  { label: "AI 채팅 관리", href: "/admin/chat", permKey: "chat" },
];

const BUSINESS_LINKS: NavLink[] = [
  { label: "제안 관리", href: "/admin/proposals", permKey: "business" },
  { label: "문의 관리", href: "/admin/inquiries", permKey: "business" },
];

const BOTTOM_LINKS: NavLink[] = [
  { label: "FAQ 관리", href: "/admin/faq", permKey: "faq" },
  { label: "계정 관리", href: "/admin/roles", permKey: "account" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
  const topLinks = TOP_LINKS.filter((link) => canSee(link.permKey));
  const businessLinks = BUSINESS_LINKS.filter((link) => canSee(link.permKey));
  const bottomLinks = BOTTOM_LINKS.filter((link) => canSee(link.permKey));

  const handleLogout = () => {
    clearAdminToken();
    router.replace("/admin/login");
    router.refresh();
  };
  const businessActive = businessLinks.some((link) =>
    isActive(pathname, link.href),
  );
  const [businessOpen, setBusinessOpen] = useState(true);

  const topClass = (active: boolean) =>
    `flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
      active ? "bg-primary text-white" : "text-[#364153] hover:bg-platinum-100"
    }`;

  return (
    <aside className="sticky top-0 flex h-dvh w-[256px] shrink-0 flex-col bg-[#fafaf9]">
      <div className="flex items-center justify-center p-[32px]">
        <LogoFull />
      </div>

      <nav className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[16px]">
        {topLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={topClass(isActive(pathname, link.href))}
          >
            {link.label}
          </Link>
        ))}

        {businessLinks.length > 0 && (
        <div className="flex flex-col gap-[6px]">
          <button
            type="button"
            onClick={() => setBusinessOpen((value) => !value)}
            className={`flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
              businessActive ? "text-primary" : "text-[#364153]"
            } hover:bg-platinum-100`}
          >
            <span className="flex-1 text-left">비즈니스 관리</span>
            <ChevronDownIcon
              className={`size-[24px] shrink-0 transition-transform ${
                businessOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {businessOpen && (
            <div className="flex flex-col gap-[6px]">
              {businessLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center rounded-[8px] py-[10px] pl-[36px] pr-[20px] text-sm leading-[20px] ${
                      active
                        ? "font-semibold text-primary"
                        : "font-medium text-[#4a5565] hover:bg-platinum-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        )}

        {bottomLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={topClass(isActive(pathname, link.href))}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="p-[20px]">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-[10px] rounded-[8px] px-[20px] py-[12px] text-base font-medium leading-[24px] text-[#364153] hover:bg-platinum-100"
        >
          <LogOutIcon className="size-[20px] shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
