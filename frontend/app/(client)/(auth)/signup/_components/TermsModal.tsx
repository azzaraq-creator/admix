"use client";

import { Button, Modal } from "@heroui/react";

import {
  HELP_CONTENT,
  HELP_TABS,
  type HelpTabKey,
} from "../../../(main)/help/content";

import { RADIUS } from "./signupUi";

/**
 * 약관 전문 — 약관동의 단계의 "보기"에서 새 탭 대신 HeroUI Modal로 띄운다.
 * 내용은 도움말(/help) 페이지와 같은 HELP_CONTENT를 쓴다.
 * 본문만 스크롤되고 제목·확인 버튼은 고정된다(scroll="inside").
 */
export function TermsModal({
  tab,
  onClose,
}: {
  /** 보여 줄 약관. null이면 닫힘. */
  tab: HelpTabKey | null;
  onClose: () => void;
}) {
  const title = HELP_TABS.find((item) => item.key === tab)?.label ?? "";

  return (
    <Modal
      isOpen={tab !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container placement="center" scroll="inside" size="lg">
          {/* 모바일은 화면 높이에서 위아래 32px씩만 남기고 꽉 채운다 — 높이를 정해 두어 Safari 주소창이
              접히고 펴져도 창이 위아래 같은 간격으로 가운데에 선다. 보이는 화면이 더 낮으면 max-h-full이 줄인다. */}
          <Modal.Dialog
            aria-label={title}
            className="max-h-[80dvh] max-sm:h-[calc(100dvh-64px)] max-sm:max-h-full"
          >
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-[18px] font-bold text-gray-900">
                {title}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="text-[13px] leading-[1.6] whitespace-pre-wrap text-gray-700">
              {tab && HELP_CONTENT[tab]}
            </Modal.Body>
            <Modal.Footer>
              {/* 버튼 44px → 곡률 19px. 색은 HeroUI 기본 회색(tertiary). */}
              <Button
                variant="tertiary"
                fullWidth
                onPress={onClose}
                className={`h-[44px] text-[14px] font-semibold ${RADIUS.h44}`}
              >
                확인
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
