"use client";

import { Button, Modal } from "@heroui/react";
import { useSyncExternalStore } from "react";

import { MaskIcon } from "@/components/common/MaskIcon";

/*
 * 광고주 회원만 쓰는 곳 안내 창 — 콜라보 소개 "의뢰서 작성하기"를 광고주가 아닌 회원이 눌렀을 때(11-23 사용자).
 * 비회원이 그 버튼으로 로그인했는데 광고주가 아니어도 같은 창 — 로그인하면 화면이 바뀌므로(소개 다시 그림 · 제휴사는 대시보드로)
 * 콜라보 레이아웃에 하나 두고 어디서든 연다(ProvisionalGate 와 같은 방식).
 */

let open = false;
const listeners = new Set<() => void>();
function setOpen(value: boolean) {
  open = value;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const openAdvertiserOnlyNotice = () => setOpen(true);

export function AdvertiserOnlyNotice() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={setOpen}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog aria-label="광고주 회원 안내">
          <Modal.CloseTrigger />
          <Modal.Header className="flex flex-col items-start gap-[10px] pr-[36px]">
            <span className="flex size-[44px] items-center justify-center rounded-[16px] bg-primary-50 text-primary-500">
              <MaskIcon src="/icons/file-text.svg" className="size-[20px]" />
            </span>
            <Modal.Heading className="text-[17px] font-bold break-keep text-gray-900">
              광고주 회원만 의뢰서를 작성할 수 있어요
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-[14px] leading-[1.6] break-keep text-gray-600">
              지금 계정은 광고주 회원이 아니에요. 광고주 계정으로 로그인해 주세요.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button
              fullWidth
              onPress={() => setOpen(false)}
              className="h-[44px] rounded-[19px] font-bold"
            >
              확인
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
