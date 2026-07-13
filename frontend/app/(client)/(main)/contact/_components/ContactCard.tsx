import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type ContactCardProps = {
  highlight?: boolean;
  children: ReactNode;
  footer: ReactNode;
};

export function ContactCard({ highlight, children, footer }: ContactCardProps) {
  return (
    <div
      className={cn(
        "flex h-[492px] min-w-[300px] flex-1 flex-col items-center rounded-[12px] border px-[32px] py-[20px]",
        highlight ? "border-primary bg-[#f4fbfa]" : "border-stroke bg-white",
      )}
    >
      <div className="flex h-[452px] w-full flex-col items-center justify-between">
        <div className="flex w-full flex-col items-center justify-center gap-[24px]">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}
