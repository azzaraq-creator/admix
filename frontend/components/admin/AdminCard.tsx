import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[16px] border border-stroke bg-white p-[48px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
