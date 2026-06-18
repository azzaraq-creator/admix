import type { ReactNode } from "react";

import { AdminSidebar } from "./_components/AdminSidebar";

export default function AdminMainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fafaf9]">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-[32px]">{children}</main>
    </div>
  );
}
