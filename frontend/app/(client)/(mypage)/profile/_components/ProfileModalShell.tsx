"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/common/buttons";
import { XIcon } from "@/components/icons";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

export const MODAL_INPUT_CLASS =
  "h-[56px] w-full rounded-[8px] border border-stroke px-[16px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#c9cad3]";

export function ProfileModalShell({
  open,
  onOpenChange,
  title,
  children,
  submitLabel = "변경",
  submitDisabled = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  submitLabel?: string;
  submitDisabled?: boolean;
  onSubmit: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[512px] max-w-[calc(100vw-32px)] flex-col">
        <div className="flex items-center justify-between p-[16px] sm:px-[30px] sm:py-[20px]">
          <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
            {title}
          </p>
          <DialogClose aria-label="닫기" className="text-black">
            <XIcon className="size-[24px]" />
          </DialogClose>
        </div>
        <div className="px-[16px] sm:px-[30px]">{children}</div>
        <div className="p-[16px] sm:px-[30px] sm:py-[20px]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={submitDisabled}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
