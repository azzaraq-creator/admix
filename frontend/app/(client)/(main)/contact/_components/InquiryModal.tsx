"use client";

import { useState } from "react";

import { ChevronRightIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const LEFT_FIELDS = [
  { label: "이름", placeholder: "이름을 입력해 주세요" },
  { label: "이메일", placeholder: "이메일 형식으로 입력해 주세요" },
  { label: "전화번호", placeholder: "전화번호를 입력해 주세요" },
  { label: "회사", placeholder: "회사명을 입력해 주세요" },
];

const CONTENT_PLACEHOLDER =
  "화장품 신제품 홍보하려고 하는데 강남 성수 지역에 MZ 타켓으로 7-8월 캠페인 생각하고 있어요.\n\n중고차 앱 프로모션 생각합니다. 서울 중요 지역 3곳 2040 대상으로 1달간 영상광고 집행 하려고 합니다.";

const INPUT_CLASS =
  "rounded-[8px] border border-stroke px-[16px] py-[18px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-[#c9cad3]";

export function InquiryModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      aria-label="문의하기"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-[20px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-[12px] bg-white"
      >
        <div className="flex items-center justify-between px-[30px] py-[20px]">
          <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
            문의하기
          </p>
          <button type="button" onClick={onClose} aria-label="닫기" className="text-black">
            <XIcon className="size-[24px]" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[20px] overflow-y-auto px-[30px]">
          <div className="flex items-start gap-[24px]">
            <div className="flex min-w-0 flex-1 flex-col gap-[20px]">
              {LEFT_FIELDS.map((field) => (
                <label key={field.label} className="flex flex-col gap-[12px]">
                  <span className="text-base font-medium leading-[24px] text-black">
                    {field.label}
                  </span>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    className={INPUT_CLASS}
                  />
                </label>
              ))}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-[16px] self-stretch">
              <label className="flex flex-col gap-[12px]">
                <span className="text-base font-medium leading-[24px] text-black">
                  제목
                </span>
                <input
                  type="text"
                  placeholder="제목을 입력해 주세요"
                  className={INPUT_CLASS}
                />
              </label>
              <textarea
                placeholder={CONTENT_PLACEHOLDER}
                className={cn(INPUT_CLASS, "min-h-[200px] flex-1 resize-none")}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-[12px] bg-[#fafafc] p-[16px]">
            <button
              type="button"
              onClick={() => setAgreed((value) => !value)}
              className="flex items-center gap-[8px]"
            >
              <span
                className={cn(
                  "flex size-[20px] items-center justify-center rounded-[6px] border",
                  agreed ? "border-primary bg-primary" : "border-stroke bg-white",
                )}
              >
                {agreed && (
                  <svg
                    viewBox="0 0 12 12"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-[12px]"
                  >
                    <path
                      d="M2.5 6.2L4.8 8.5L9.5 3.5"
                      stroke="white"
                      strokeWidth={1.6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              <span className="text-sm font-bold leading-[20px] text-[#545454]">
                개인정보 수집 및 이용
              </span>
            </button>
            <button
              type="button"
              aria-label="개인정보 처리방침 보기"
              className="text-[#545454]"
            >
              <ChevronRightIcon className="size-[20px]" />
            </button>
          </div>
        </div>

        <div className="px-[30px] py-[20px]">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-[8px] bg-primary px-[24px] py-[16px] text-base font-semibold leading-[24px] text-white"
          >
            제출하기
          </button>
        </div>
      </div>
    </div>
  );
}
