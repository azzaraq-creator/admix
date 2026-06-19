import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { ADMIN_TOKEN_COOKIE } from "@/lib/adminToken";

import { AdminSidebar } from "./_components/AdminSidebar";

export default async function AdminMainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const token = (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-[#fafaf9]">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-[32px]">{children}</main>
    </div>
  );
}
