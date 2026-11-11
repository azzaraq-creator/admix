"use client";

import { Button, Modal } from "@heroui/react";
import { FileText } from "lucide-react";

import { SquareCheck } from "@/components/common/SquareCheck";
import {
  CONFIRM_SENTENCE,
  confirmItemsOf,
  kstFullStamp,
  type PreviewCollab,
} from "@/lib/partnersPreview";

import { StatusChip } from "./workspaceUi";

/**
 * 콜라보 확정서 — 콜라보 상세 "지금 상황" 카드의 확정서 줄에서 연다(HeroUI Modal).
 * 확정 번호 · 콜라보 · 확정 일시 · 확인자 + 최종 확정 때 하나씩 확인한 진행 항목과 확정 문장.
 * 참여 이력의 콜라보 줄에서도 연다(문서함을 없애고 콜라보마다 붙였다, 2026-11-09).
 */
export function ConfirmDocModal({
  c,
  isOpen,
  onOpenChange,
}: {
  c: PreviewCollab;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const items = confirmItemsOf(c);
  const checked = c.checkedItems ?? 0;
  const facts: [string, string][] = [
    ["콜라보", `${c.brand} · ${c.title}`],
    ["확정 일시", c.confirmedAt ? kstFullStamp(c.confirmedAt) : "-"],
    ["확인자", c.confirmer ?? "-"],
  ];
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" size="md" scroll="inside">
          <Modal.Dialog aria-label="콜라보 확정서">
            <Modal.CloseTrigger />
            <Modal.Header className="flex-row items-center gap-[12px]">
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-[12px] bg-primary-50 text-primary-600">
                <FileText className="size-[20px]" />
              </span>
              <div className="flex min-w-0 flex-col">
                <Modal.Heading className="text-[18px] font-bold text-gray-900">
                  콜라보 확정서
                </Modal.Heading>
                <span className="text-[13px] font-semibold text-gray-500 tabular-nums">
                  {c.confirmNo}
                </span>
              </div>
              {c.standing === "cancelled" && (
                <span className="ml-auto">
                  <StatusChip tone="red">광고주 취소</StatusChip>
                </span>
              )}
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-[18px] text-[14px] break-keep">
              <dl className="flex flex-col gap-[8px] rounded-[16px] bg-gray-50 px-[16px] py-[14px]">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex gap-[12px]">
                    <dt className="w-[64px] shrink-0 text-[13px] text-gray-500">
                      {k}
                    </dt>
                    <dd className="min-w-0 font-semibold text-gray-900">{v}</dd>
                  </div>
                ))}
              </dl>

              <section className="flex flex-col gap-[10px]">
                <h3 className="text-[14px] font-bold text-gray-900">
                  확인한 진행 항목{" "}
                  <span className="text-gray-400 tabular-nums">
                    {checked} / {items.length}
                  </span>
                </h3>
                <ul className="flex flex-col gap-[10px]">
                  {items.map((item, i) => (
                    <li key={item.id} className="flex items-start gap-[10px]">
                      <SquareCheck
                        on={i < checked}
                        label={i < checked ? "확인함" : "확인 안 함"}
                        className="mt-[1px]"
                      />
                      <div className="flex min-w-0 flex-col">
                        <b className="text-[13px] text-gray-900">
                          {item.label}
                        </b>
                        <span className="text-[13px] leading-[1.55] text-gray-600">
                          {item.value}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <p className="rounded-[14px] border border-gray-200 px-[14px] py-[12px] text-[13px] leading-[1.6] text-gray-700">
                {CONFIRM_SENTENCE}
              </p>
              <small className="text-[12px] text-gray-400">
                확정서는 참여 이력의 이 콜라보 줄에서 언제든 다시 볼 수 있어요.
              </small>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => onOpenChange(false)}
                className="h-[44px] w-full rounded-[18px] text-[15px] font-semibold"
              >
                닫기
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
