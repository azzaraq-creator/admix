"use client";

import { Button, FieldError, Input, Modal, TextField } from "@heroui/react";
import { useState } from "react";

import { XIcon } from "@/components/icons";

/** 기획안 이름 최대 길이 — 목록·PPT 표지에서 한눈에 보이도록 넉넉히 제한한다. */
const MAX_NAME_LENGTH = 50;

// 입력칸 44px → 곡률 19px. 로그인 창처럼 평소 회색, 마우스를 올리거나 입력 중이면 흰 바탕.
// 입력 중에는 1px 테두리가 보라색(HeroUI 포커스 색)으로 바뀐다.
const FIELD_CLASS =
  "h-[44px] rounded-[19px] border border-black-200 bg-black-100 px-[16px] text-[14px] text-black-900 [box-shadow:none]! transition-colors " +
  "placeholder:text-black-400 hover:bg-white data-[hovered=true]:bg-white focus:border-focus data-[focused=true]:bg-white data-[invalid=true]:border-danger data-[invalid=true]:outline-none";

// 버튼 40px → 곡률 17px. 오른쪽 아래에 내용 폭만큼 나란히 둔다.
const ACTION_CLASS =
  "h-[40px] min-w-[76px] rounded-[17px] px-[18px] text-[14px] font-semibold";

/**
 * 새 기획안 만들기 — HeroUI Modal. 로그인 창·"새 대화" 확인창과 같은 흰 창(모서리 24px)에
 * 이름 입력칸 하나와 취소/만들기 버튼. Enter로도 만들 수 있다.
 */
export function NewProposalModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 성공이면 null, 실패면 인라인으로 표시할 에러 문구를 반환.
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();

  const reset = () => {
    setName("");
    setError(null);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const message = await onCreate(trimmed);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    close();
  };

  return (
    <Modal
      isOpen={open}
      onOpenChange={(value) => {
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="새 기획안 만들기"
            className="w-full max-w-[420px] gap-0 rounded-[24px] bg-white px-[24px] pt-[28px] pb-[24px] shadow-[0px_20px_60px_-12px_rgba(47,52,66,0.28)] sm:px-[28px]"
          >
            {/* 닫기 32px → 곡률 13px. */}
            <Modal.CloseTrigger
              aria-label="닫기"
              className="top-[16px] right-[16px] size-[32px] rounded-[13px] bg-transparent p-0 text-black-400 data-[hovered=true]:bg-black-50 data-[hovered=true]:text-black"
            >
              <XIcon className="size-[20px]" />
            </Modal.CloseTrigger>

            <Modal.Header className="flex flex-col gap-[6px] p-0 pr-[32px]">
              <Modal.Heading className="text-[18px] font-bold text-black-900">
                새 기획안 만들기
              </Modal.Heading>
              <p className="text-[13px] leading-[1.5] text-black-500">
                기획안 이름을 정해 주세요. 이름은 나중에도 바꿀 수 있어요.
              </p>
            </Modal.Header>

            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
              className="flex flex-col"
            >
              <Modal.Body className="m-0 mt-[20px] overflow-visible p-0">
                <TextField
                  value={name}
                  onChange={(value) => {
                    setName(value);
                    if (error) setError(null);
                  }}
                  isInvalid={!!error}
                  maxLength={MAX_NAME_LENGTH}
                  aria-label="기획안 이름"
                  autoFocus
                  fullWidth
                  className="gap-[6px]"
                >
                  <Input
                    placeholder="예) 2026 하반기 강남 옥외광고"
                    className={FIELD_CLASS}
                  />
                  <div className="flex items-start justify-between gap-[8px] px-[4px]">
                    <FieldError className="text-[12px] text-danger">
                      {error}
                    </FieldError>
                    <span className="ml-auto shrink-0 text-[12px] text-black-400">
                      {name.length}/{MAX_NAME_LENGTH}
                    </span>
                  </div>
                </TextField>
              </Modal.Body>

              <Modal.Footer className="mt-[20px] flex justify-end gap-[8px] p-0">
                <Button
                  type="button"
                  variant="tertiary"
                  onPress={close}
                  className={ACTION_CLASS}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  isDisabled={!trimmed}
                  isPending={submitting}
                  className={`${ACTION_CLASS} bg-primary text-white`}
                >
                  {submitting ? "만드는 중..." : "만들기"}
                </Button>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
