import { List } from "lucide-react";
import type { ComponentProps } from "react";

import { FileDownIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SHADOW =
  "shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]";

export function ExcelDownloadButton({
  className,
  children = "엑셀 다운로드",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[40px] items-center gap-[8px] rounded-[6px] border border-[#4ca452] bg-white px-[17px] text-sm font-semibold leading-[20px] tracking-[-0.28px] text-[#4ca452] transition-colors hover:bg-[#f0f8f1] active:translate-y-px active:bg-[#dcefdf]",
        className,
      )}
      {...props}
    >
      <FileDownIcon className="size-[16px]" />
      {children}
    </button>
  );
}

export function ListButton({
  className,
  children = "목록으로",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[36px] items-center justify-center gap-[6px] rounded-[6px] border border-[#ebebeb] bg-white px-[16px] text-sm font-medium leading-[20px] text-[#0a0a0a] transition-colors hover:bg-[#f7f7f7] active:translate-y-px active:bg-[#efefef]",
        SHADOW,
        className,
      )}
      {...props}
    >
      <List className="size-[16px]" />
      {children}
    </button>
  );
}

export function PrimaryButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-[36px] min-w-[81px] rounded-[6px] px-[16px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800 active:bg-primary-900",
        SHADOW,
        className,
      )}
      {...props}
    />
  );
}

export function DeleteButton({
  className,
  children = "삭제",
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex h-[36px] items-center justify-center rounded-[6px] bg-[#f1f5f9] px-[16px] text-sm font-medium leading-[20px] text-[#2f3442] transition-colors hover:bg-[#e2e8f0] active:translate-y-px active:bg-[#cbd5e1]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
