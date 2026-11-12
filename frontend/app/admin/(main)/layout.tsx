import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ADMIN_TOKEN_COOKIE } from "@/lib/adminToken";

import { AdminAccessGate } from "./_components/AdminAccessGate";
import { AdminSidebar } from "./_components/AdminSidebar";

export default async function AdminMainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) redirect("/admin/login");

  return (
    // 본문 바탕은 옅은 회색(gray-50), 구역마다 테두리 없는 흰 카드(AdminPanel)로 나눈다 — 매장 상세에서 정한 모양을
    // 어드민 전체로 넓혔다(2026-11-12 사용자 "카드는 흰색, 배경은 다른 색" → "다른 페이지들도 동일한 UI로").
    <div className="flex min-h-dvh flex-col bg-surface lg:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-[16px] py-[20px] bg-gray-50 sm:px-[24px] lg:px-[32px] lg:py-[28px]">
        <AdminAccessGate>{children}</AdminAccessGate>
      </main>
    </div>
  );
}
