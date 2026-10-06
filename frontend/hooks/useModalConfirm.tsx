"use client";

import { Button, Modal } from "@heroui/react";
import Image from "next/image";
import { useCallback, useRef, useState, type ReactNode } from "react";

import { CloseMediumIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /**
   * 삭제처럼 되돌릴 수 없는 동작 — 확인 버튼을 HeroUI danger(빨강)로 하고,
   * 제목 위에 빨간 휴지통(public/icons/trash.svg)을 띄운다.
   */
  destructive?: boolean;
  /** 안내만 하는 창 — 취소 버튼 없이 확인 버튼 하나만 둔다. */
  hideCancel?: boolean;
  /** 제목 위 아이콘(회색 칸) — 예: 안내용 느낌표. destructive면 빨간 휴지통이 우선한다. */
  icon?: ReactNode;
  /** 아이콘 칸 색 — primary면 연보라 바탕(아이콘도 메인 컬러로 넘긴다). 기본은 회색. */
  iconTone?: "neutral" | "primary";
  /**
   * 기획안 제출·제출 취소 시안("03. 제안서 - 상세" 컨펌) 모양 — 설명 16px 진회색, 버튼은 오른쪽에
   * 내용 폭(취소 90px · 확인 130px)으로 붙인다. width로 창 폭을 정한다(기본 400px).
   */
  compactActions?: boolean;
  width?: number;
  /** 확인 버튼을 보라 대신 회색(취소 버튼과 같은 모양)으로 — 단순 안내용. */
  neutral?: boolean;
};

// 버튼 — 매체 정보·기획안에 담기 팝업 하단 버튼과 같은 모양(13px, 곡률 15px).
const ACTION_CLASS =
  "h-auto min-w-0 flex-1 rounded-[15px] px-[14px] py-[10px] text-[13px] font-medium";

/**
 * 확인창 — useConfirm과 같은 사용법(`await confirm({...})` → true/false)을 HeroUI Modal로.
 * 모양은 ADMIX 팝업(매체 정보·기획안에 담기)과 같다: 모서리 20px, 회색 원형 닫기, 16px 제목.
 */
export function useModalConfirm() {
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
    <Modal
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) settle(false);
      }}
    >
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            role="alertdialog"
            aria-label={options?.title}
            style={options?.width ? { maxWidth: options.width } : undefined}
            className="w-full max-w-[400px] gap-0 rounded-[20px] bg-white p-[20px] shadow-[0px_4px_60px_0px_rgba(0,0,0,0.25)] max-sm:p-[16px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="top-[20px] right-[20px] z-10 size-[28px] rounded-[14px] border border-[#ececef] bg-[#eaeaeb] p-0 text-[#70707a] max-sm:top-[16px] max-sm:right-[16px]"
            >
              <CloseMediumIcon className="size-[24px]" />
            </Modal.CloseTrigger>

            <Modal.Header className="flex min-h-[28px] flex-col justify-center gap-[6px] p-0 pr-[40px]">
              {options?.destructive && (
                // 아이콘 칸 44px → 곡률 19px. 옅은 빨강 바탕.
                <span className="mb-[6px] flex size-[44px] items-center justify-center rounded-[19px] bg-[#fef2f2]">
                  <Image src="/icons/trash.svg" alt="" width={22} height={22} />
                </span>
              )}
              {!options?.destructive && options?.icon && (
                // 아이콘 칸 44px → 곡률 19px. 회색(또는 연보라) 바탕.
                <span
                  aria-hidden
                  className={cn(
                    "mb-[6px] flex size-[44px] items-center justify-center rounded-[19px]",
                    options.iconTone === "primary"
                      ? "bg-primary-50 text-primary-500"
                      : "bg-[#f4f4f5] text-[#52525b]",
                  )}
                >
                  {options.icon}
                </span>
              )}
              <Modal.Heading
                className={cn(
                  "text-[16px] leading-[1.4] font-semibold break-keep text-black",
                  options?.compactActions && "font-bold text-[#111827]",
                )}
              >
                {options?.title}
              </Modal.Heading>
              {options?.description && (
                <div
                  className={cn(
                    "text-[14px] leading-[1.6] whitespace-pre-line text-[#71717a]",
                    options?.compactActions &&
                      "pt-[14px] pb-[10px] text-[16px] leading-[23px] text-[#374151]",
                  )}
                >
                  {options.description}
                </div>
              )}
            </Modal.Header>

            <Modal.Footer
              className={cn(
                "mt-[20px] flex gap-[8px] p-0",
                options?.compactActions && "justify-end",
              )}
            >
              {!options?.hideCancel && (
                <Button
                  variant="ghost"
                  onPress={() => settle(false)}
                  className={cn(
                    ACTION_CLASS,
                    "bg-[#eee] text-[#18181b]",
                    options?.compactActions && "w-[90px] flex-none",
                  )}
                >
                  {options?.cancelText ?? "취소"}
                </Button>
              )}
              <Button
                variant={options?.destructive ? "danger" : "primary"}
                onPress={() => settle(true)}
                className={cn(
                  ACTION_CLASS,
                  options?.compactActions && "w-[130px] flex-none",
                  !options?.destructive &&
                    (options?.neutral
                      ? "bg-[#eee] text-[#18181b]"
                      : "bg-primary-500 text-white"),
                )}
              >
                {options?.confirmText ?? "확인"}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );

  return { confirm, confirmDialog };
}
