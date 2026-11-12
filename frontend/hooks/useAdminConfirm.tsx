"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useCallback, useRef, useState, type ReactNode } from "react";

type AdminConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
};

type AdminConfirmState = AdminConfirmOptions & { mode: "confirm" | "alert" };

/**
 * 어드민 확인 · 알림 창(HeroUI AlertDialog). `const ok = await confirm({...})`, `await alert({...})`처럼 쓰고,
 * 돌려받은 `confirmDialog` 를 화면 어딘가에 그려 둔다. 바깥을 누르거나 Esc 로 닫으면 취소(false).
 */
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
    <AlertDialog.Backdrop
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) settle(false);
      }}
      isDismissable
      isKeyboardDismissDisabled={false}
    >
      <AlertDialog.Container placement="center" size="sm">
        <AlertDialog.Dialog className="rounded-[20px]">
          <AlertDialog.Header>
            <AlertDialog.Heading className="text-lg font-bold leading-[28px] tracking-[-0.04px] text-black">
              {state?.title}
            </AlertDialog.Heading>
          </AlertDialog.Header>
          {state?.description && (
            <AlertDialog.Body>
              <div className="whitespace-pre-line text-sm font-medium leading-[20px] text-disabled">
                {state.description}
              </div>
            </AlertDialog.Body>
          )}
          <AlertDialog.Footer>
            {state?.mode === "confirm" && (
              <Button variant="tertiary" onPress={() => settle(false)}>
                {state?.cancelText ?? "취소"}
              </Button>
            )}
            <Button variant="primary" onPress={() => settle(true)}>
              {state?.confirmText ?? "확인"}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );

  return { confirm, alert, confirmDialog };
}
