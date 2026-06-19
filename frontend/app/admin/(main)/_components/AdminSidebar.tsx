"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ChevronDownIcon, LogoFull, LogOutIcon } from "@/components/icons";
import { clearAdminToken } from "@/lib/adminToken";

type NavLink = { label: string; href: string };

const TOP_LINKS: NavLink[] = [
  { label: "대시보드", href: "/admin" },
  { label: "광고 매체 관리", href: "/admin/media" },
  { label: "회원 관리", href: "/admin/members" },
  { label: "AI 채팅 관리", href: "/admin/chat" },
];

const BUSINESS_LINKS: NavLink[] = [
  { label: "제안 관리", href: "/admin/proposals" },
  { label: "문의 관리", href: "/admin/inquiries" },
];

const BOTTOM_LINKS: NavLink[] = [
  { label: "FAQ 관리", href: "/admin/faq" },
  { label: "계정 관리", href: "/admin/roles" },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    clearAdminToken();
    router.replace("/admin/login");
    router.refresh();
  };
  const businessActive = BUSINESS_LINKS.some((link) =>
    isActive(pathname, link.href),
  );
  const [businessOpen, setBusinessOpen] = useState(true);

  const topClass = (active: boolean) =>
    `flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
      active ? "bg-primary text-white" : "text-[#364153] hover:bg-[#f1f5f9]"
    }`;

  return (
    <aside className="sticky top-0 flex h-screen w-[256px] shrink-0 flex-col bg-[#fafaf9]">
      <div className="flex items-center justify-center p-[32px]">
        <LogoFull />
      </div>

      <nav className="flex flex-1 flex-col gap-[16px] overflow-y-auto px-[20px] py-[16px]">
        {TOP_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={topClass(isActive(pathname, link.href))}
          >
            {link.label}
          </Link>
        ))}

        <div className="flex flex-col gap-[6px]">
          <button
            type="button"
            onClick={() => setBusinessOpen((value) => !value)}
            className={`flex w-full items-center rounded-[8px] px-[20px] py-[12px] text-base font-semibold leading-[24px] ${
              businessActive ? "text-primary" : "text-[#364153]"
            } hover:bg-[#f1f5f9]`}
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
              {BUSINESS_LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center rounded-[8px] py-[10px] pl-[36px] pr-[20px] text-sm leading-[20px] ${
                      active
                        ? "font-semibold text-primary"
                        : "font-medium text-[#4a5565] hover:bg-[#f1f5f9]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {BOTTOM_LINKS.map((link) => (
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
          className="flex w-full items-center gap-[10px] rounded-[8px] px-[20px] py-[12px] text-base font-medium leading-[24px] text-[#364153] hover:bg-[#f1f5f9]"
        >
          <LogOutIcon className="size-[20px] shrink-0" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
