"use client";

import { AlertDialog, Button } from "@heroui/react";
import { useState } from "react";

import { RotateCwIcon } from "@/components/icons";

import { useMixieChat } from "./useMixieChat";

// 곡률 규칙: 높이/2 - 3px. HeroUI 기본 버튼 높이 36px → 15px.
const DIALOG_BUTTON = "rounded-[15px] font-semibold";

/**
 * 믹시 "새 대화" 버튼 — 대시보드와 AI 믹시 패널이 함께 쓴다. 누르면 지금 대화가 사라진다는
 * 확인창(HeroUI AlertDialog)을 먼저 띄우고, 확인해야 새 대화를 시작한다.
 */
export function NewChatButton() {
  const { chat } = useMixieChat();
  const [open, setOpen] = useState(false);

  const start = () => {
    setOpen(false);
    void chat.newSession();
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        isDisabled={chat.running}
        onPress={() => setOpen(true)}
        className="h-auto min-w-0 gap-[4px] bg-transparent p-0 text-[13px] font-medium text-gray-500 data-[hovered=true]:bg-transparent data-[hovered=true]:text-primary"
      >
        <RotateCwIcon className="size-[14px]" />새 대화
      </Button>

      <AlertDialog isOpen={open} onOpenChange={setOpen}>
        {/* AlertDialog는 기본으로 Esc를 막는다. Esc는 "취소"로 받아 준다(바깥 클릭은 그대로 막는다). */}
        <AlertDialog.Backdrop isKeyboardDismissDisabled={false}>
          <AlertDialog.Container placement="center" size="sm">
            <AlertDialog.Dialog className="rounded-[24px]">
              <AlertDialog.Header>
                {/* 기본 느낌표 대신 "새 대화" 버튼과 같은 초기화 아이콘. 빨간 칸(danger)은 그대로. */}
                <AlertDialog.Icon status="danger">
                  <RotateCwIcon className="size-[20px]" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>새 대화를 시작할까요?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-[14px] leading-[22px] text-gray-500">
                  지금까지 믹시와 나눈 대화 기록이 모두 사라지고,
                  <br />
                  다시 볼 수 없어요.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  slot="close"
                  variant="tertiary"
                  className={DIALOG_BUTTON}
                >
                  취소
                </Button>
                <Button
                  variant="danger"
                  onPress={start}
                  className={DIALOG_BUTTON}
                >
                  새 대화 시작
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </>
  );
}
