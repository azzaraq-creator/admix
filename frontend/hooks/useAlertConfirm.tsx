"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useCallback, useRef, useState, type ReactNode } from "react";

type AlertConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** 되돌릴 수 없는 동작(탈퇴·삭제 등) — 확인 버튼을 빨갛게, 아이콘을 경고로. */
  destructive?: boolean;
  /** 안내만 할 때(실패 알림 등) — 취소 버튼 없이 확인 하나만. */
  alertOnly?: boolean;
};

// 곡률 규칙: 높이/2 - 3px. HeroUI 기본 버튼 높이 36px → 15px.
const DIALOG_BUTTON = "rounded-[15px] font-semibold";

/**
 * HeroUI AlertDialog로 띄우는 확인창. `const ok = await confirm({...})`처럼 쓰고,
 * 반환된 confirmDialog를 화면 어딘가에 렌더해 둔다(useConfirm과 같은 사용법).
 * Esc는 취소로 받고, 바깥 클릭으로는 닫히지 않는다.
 */
export function useAlertConfirm() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AlertConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: AlertConfirmOptions) =>
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
    <AlertDialog
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
        <AlertDialog.Container placement="center" size="sm">
          <AlertDialog.Dialog className="rounded-[24px]">
            <AlertDialog.Header>
              <AlertDialog.Icon
                status={options?.destructive ? "danger" : "accent"}
              />
              <AlertDialog.Heading>{options?.title}</AlertDialog.Heading>
            </AlertDialog.Header>
            {options?.description && (
              <AlertDialog.Body>
                <div className="text-[14px] leading-[22px] text-gray-500">
                  {options.description}
                </div>
              </AlertDialog.Body>
            )}
            <AlertDialog.Footer>
              {!options?.alertOnly && (
                <Button
                  variant="tertiary"
                  onPress={() => settle(false)}
                  className={DIALOG_BUTTON}
                >
                  {options?.cancelText ?? "취소"}
                </Button>
              )}
              <Button
                variant={options?.destructive ? "danger" : "primary"}
                onPress={() => settle(true)}
                className={DIALOG_BUTTON}
              >
                {options?.confirmText ?? "확인"}
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );

  return { confirm, confirmDialog };
}
