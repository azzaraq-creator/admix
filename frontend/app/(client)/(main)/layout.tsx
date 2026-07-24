import type { ReactNode } from "react";

import { LoginModal } from "./_components/LoginModal";
import { MobileTopNav } from "./_components/MobileTopNav";
import { Sidebar } from "./_components/Sidebar";

export default function ClientMainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh w-full bg-white">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileTopNav />
        <div className="relative flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
      <LoginModal />
    </div>
  );
}
