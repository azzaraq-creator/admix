"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setOptions(next);
        setOpen(true);
      }),
    [],
  );

  const settle = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const confirmDialog = (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) settle(false);
      }}
    >
      <DialogContent className="flex w-[calc(100vw-32px)] max-w-[400px] flex-col gap-[20px] px-[16px] py-[20px] sm:px-[30px]">
        <div className="flex flex-col gap-[12px]">
          <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
            {options?.title}
          </p>
          {options?.description && (
            <div className="whitespace-pre-line text-base font-medium leading-[24px] text-[#737586]">
              {options.description}
            </div>
          )}
        </div>
        <div className="flex items-center gap-[6px]">
          <button
            type="button"
            onClick={() => settle(false)}
            className="flex flex-1 items-center justify-center rounded-[8px] bg-[#f1f5f9] px-[16px] py-[12px] text-base font-medium text-[#2f3442]"
          >
            {options?.cancelText ?? "취소"}
          </button>
          <button
            type="button"
            onClick={() => settle(true)}
            className={`flex flex-1 items-center justify-center rounded-[8px] px-[16px] py-[12px] text-base font-medium ${
              options?.destructive
                ? "border border-red-400 bg-white text-red-400"
                : "bg-primary text-white"
            }`}
          >
            {options?.confirmText ?? "확인"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirm, confirmDialog };
}
