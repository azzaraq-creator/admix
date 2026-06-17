import type { ReactNode } from "react";

import { AdminSidebar } from "./_components/AdminSidebar";

export default function AdminMainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#fafaf9]">
      <AdminSidebar />
      <main className="min-w-0 flex-1 p-[32px]">
        <div className="rounded-[16px] border border-stroke bg-white p-[48px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04)]">
          {children}
        </div>
      </main>
    </div>
  );
}
