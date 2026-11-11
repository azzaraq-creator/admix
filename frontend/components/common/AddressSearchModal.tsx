"use client";

import { Modal } from "@heroui/react";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  embedAddressSearch,
  type DaumPostcodeResult,
} from "@/lib/daumPostcode";

/**
 * 주소 검색 팝업 — 카카오(다음) 우편번호 서비스를 HeroUI Modal 안에 끼워 넣는다(새 브라우저 창 대신).
 * 주소를 고르면 onSelect 를 부르고 창을 닫는다.
 */
export function AddressSearchModal({
  isOpen,
  onOpenChange,
  onSelect,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (data: DaumPostcodeResult) => void;
}) {
  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Backdrop>
        <Modal.Container placement="center" className="px-[16px] sm:px-0">
          <Modal.Dialog
            aria-label="주소 검색"
            className="flex w-full max-w-[520px] flex-col gap-[12px] rounded-[20px] bg-surface p-[16px] sm:p-[20px]"
          >
            <Modal.CloseTrigger
              aria-label="닫기"
              className="right-[12px] top-[12px] size-[32px] rounded-full bg-transparent p-0 text-gray-400 data-[hovered=true]:bg-gray-50 data-[hovered=true]:text-black sm:right-[16px] sm:top-[16px]"
            >
              <X className="size-[18px]" />
            </Modal.CloseTrigger>
            <Modal.Header className="p-0 pr-[36px]">
              <Modal.Heading className="text-lg font-bold leading-[26px] text-black">
                주소 검색
              </Modal.Heading>
            </Modal.Header>
            {/* 열 때마다 검색 화면을 새로 끼운다. */}
            {isOpen && (
              <PostcodeFrame
                onSelect={(data) => {
                  onSelect(data);
                  onOpenChange(false);
                }}
              />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function PostcodeFrame({
  onSelect,
}: {
  onSelect: (data: DaumPostcodeResult) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    selectRef.current = onSelect;
  });

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let alive = true;
    embedAddressSearch(box, (data) => selectRef.current(data)).catch(
      (err: unknown) => {
        if (alive)
          setError(
            err instanceof Error ? err.message : "주소 검색을 열지 못했어요.",
          );
      },
    );
    return () => {
      alive = false;
      box.replaceChildren();
    };
  }, []);

  return error ? (
    <p className="py-[40px] text-center text-sm text-[#d65856]">{error}</p>
  ) : (
    <div
      ref={boxRef}
      className="h-[min(480px,70dvh)] w-full overflow-hidden rounded-[12px] border border-stroke"
    />
  );
}
