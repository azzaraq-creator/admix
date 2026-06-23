"use client";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type SimpleViewToggleProps = {
  simple: boolean;
  onChange: (simple: boolean) => void;
  className?: string;
};

export function SimpleViewToggle({
  simple,
  onChange,
  className,
}: SimpleViewToggleProps) {
  return (
    <div className={cn("flex items-center gap-[6px]", className)}>
      <span className="text-sm font-medium leading-[20px] text-[#757575]">
        간략히보기
      </span>
      <Switch checked={simple} onCheckedChange={onChange} />
    </div>
  );
}
