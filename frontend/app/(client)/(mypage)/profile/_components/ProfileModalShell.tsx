"use client";

import { Button, Modal, Spinner } from "@heroui/react";
import type { ReactNode } from "react";

import { XIcon } from "@/components/icons";

/*
 * 프로필 화면의 작은 변경 창(비밀번호·연락받을 이메일) — HeroUI Modal.
 * 겉모양은 로그인 창(LoginModal)과 같은 ADMIX 톤: 둥근 흰 카드, 회색 입력칸(선택·입력 중엔 흰색),
 * 보라는 확인 버튼에만. 곡률 규칙: 높이/2 - 3px (입력칸·버튼 40px → 17px).
 */

/**
 * 창 안 입력칸(HeroUI Input) — 로그인 창·매체 찾기 검색바와 같은 ADMIX 입력칸.
 * 회색 필(black-100 바탕·black-200 테두리), 올리거나 입력 중이면 흰 바탕(테두리는 그대로라 흰 창 위에서도 보인다).
 * 포커스 링은 없고, 잘못된 입력이면 테두리만 빨갛게.
 */
export const MODAL_INPUT_CLASS =
  "h-[40px] w-full rounded-[17px] border border-black-200 bg-black-100 px-[16px] text-[14px] text-black-900 transition-colors [box-shadow:none]! max-sm:h-[36px] max-sm:rounded-[15px] max-sm:px-[14px] max-sm:text-[13px] " +
  "placeholder:text-black-400 data-[hovered=true]:bg-white data-[focused=true]:bg-white data-[invalid=true]:border-danger " +
  "data-[disabled=true]:bg-black-50 data-[disabled=true]:opacity-100 data-[disabled=true]:text-black-400";

/** 창 안 라벨(HeroUI Label). */
export const MODAL_LABEL_CLASS =
  "text-[13px] font-medium text-black-700 max-sm:text-[12px]";

/** 창 안 오류 문구(HeroUI FieldError). */
export const MODAL_ERROR_CLASS = "text-[12px] text-danger max-sm:text-[11px]";

export function ProfileModalShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  submitLabel = "변경",
  submitDisabled = false,
  submitPending = false,
  pendingLabel,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  submitLabel?: string;
  submitDisabled?: boolean;
  submitPending?: boolean;
  /** 처리 중 버튼 문구(없으면 submitLabel 그대로). */
  pendingLabel?: string;
  onSubmit: () => void;
}) {
  return (
    <Modal isOpen={open} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label={title}
            className="w-full max-w-[440px] gap-0 rounded-[24px] bg-white px-[24px] pt-[28px] pb-[24px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] max-sm:px-[16px] max-sm:pt-[20px] max-sm:pb-[16px] sm:px-[32px]"
          >
            {/* 제목 줄(위 28px + 줄높이 26px)의 가운데(41px)에 X(32px)의 가운데를 맞춘다 → top 25px.
                모바일은 위 20px + 줄높이 22px → 가운데 31px, X 28px → top 17px. */}
            <Modal.CloseTrigger
              aria-label="닫기"
              className="top-[25px] right-[20px] size-[32px] rounded-full max-sm:top-[17px] max-sm:right-[12px] max-sm:size-[28px] bg-transparent p-0 text-black-400 data-[hovered=true]:bg-black-50 data-[hovered=true]:text-black"
            >
              <XIcon className="size-[20px] max-sm:size-[18px]" />
            </Modal.CloseTrigger>

            <Modal.Header className="flex flex-col gap-[4px] p-0 pr-[32px]">
              <Modal.Heading className="text-[18px] leading-[26px] font-bold text-black-900 max-sm:text-[16px] max-sm:leading-[22px]">
                {title}
              </Modal.Heading>
              {description && (
                <p className="text-[13px] leading-[20px] text-black-500 max-sm:text-[12px] max-sm:leading-[18px]">
                  {description}
                </p>
              )}
            </Modal.Header>

            {/* Enter로도 제출되게 form으로 감싼다. */}
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                if (!submitDisabled && !submitPending) onSubmit();
              }}
            >
              <Modal.Body className="m-0 mt-[20px] overflow-visible p-0 max-sm:mt-[16px]">
                {children}
              </Modal.Body>

              <Modal.Footer className="mt-[24px] p-0 max-sm:mt-[20px]">
                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  isDisabled={submitDisabled}
                  isPending={submitPending}
                  className="h-[40px] gap-[8px] rounded-[17px] bg-primary text-[14px] font-semibold text-white max-sm:h-[36px] max-sm:rounded-[15px] max-sm:text-[13px]"
                >
                  {submitPending && <Spinner size="sm" color="current" />}
                  {submitPending ? (pendingLabel ?? submitLabel) : submitLabel}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
