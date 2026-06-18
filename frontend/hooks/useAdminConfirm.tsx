"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";

type AdminConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
};

type AdminConfirmState = AdminConfirmOptions & { mode: "confirm" | "alert" };

export function useAdminConfirm() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<AdminConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: AdminConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setState({ ...options, mode: "confirm" });
        setOpen(true);
      }),
    [],
  );

  const alert = useCallback(
    (options: AdminConfirmOptions) =>
      new Promise<void>((resolve) => {
        resolverRef.current = () => resolve();
        setState({ ...options, mode: "alert" });
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
      <DialogContent className="flex w-[460px] flex-col gap-[20px] p-[24px]">
        <div className="flex flex-col gap-[8px]">
          <p className="text-lg font-bold leading-[28px] tracking-[-0.04px] text-[#2f3442]">
            {state?.title}
          </p>
          {state?.description && (
            <div className="whitespace-pre-line text-sm font-medium leading-[20px] text-[#737586]">
              {state.description}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-[8px]">
          {state?.mode === "confirm" && (
            <button
              type="button"
              onClick={() => settle(false)}
              className="rounded-[8px] bg-[#f1f5f9] px-[16px] py-[10px] text-sm font-medium leading-[20px] text-[#2f3442] transition-colors hover:bg-[#e2e8f0]"
            >
              {state?.cancelText ?? "취소"}
            </button>
          )}
          <button
            type="button"
            onClick={() => settle(true)}
            className="rounded-[8px] bg-primary px-[16px] py-[10px] text-sm font-medium leading-[20px] text-white transition-colors hover:bg-primary-800"
          >
            {state?.confirmText ?? "확인"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { confirm, alert, confirmDialog };
}
