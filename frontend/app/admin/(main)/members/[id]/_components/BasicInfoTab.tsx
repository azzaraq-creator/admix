"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

const INFO_ROWS = [
  { label: "회원 유형", value: "기업" },
  { label: "회사명", value: "ADMIX" },
  { label: "이름", value: "홍길동" },
  { label: "이메일", value: "hong@naver.com" },
  { label: "전화번호", value: "01012345678" },
  { label: "가입일", value: "2026-01-01" },
  { label: "탈퇴일", value: "-" },
  { label: "마케팅 수신", value: "동의" },
];

const BIZ_ROWS = [
  { label: "사업자명", placeholder: "사업자명 입력", required: true },
  { label: "사업자등록번호", placeholder: "사업자등록번호 입력", required: true },
  { label: "주소", placeholder: "주소 입력", required: true },
  { label: "사업의 종류", placeholder: "업태 및 종목 입력", required: true },
  { label: "반려 사유", placeholder: "반려 사유 입력", required: false },
];

const CARD_CLASS =
  "flex flex-col gap-[24px] rounded-[12px] border border-[#cdcdcd] p-[36px]";
const CARD_TITLE = "text-xl font-semibold leading-[24px] text-[#2a2a2a]";

function FieldLabel({
  label,
  required,
}: {
  label: string;
  required?: boolean;
}) {
  return (
    <div className="flex w-[160px] shrink-0 items-center gap-[4px]">
      <span className="flex-1 text-xl font-semibold leading-[24px] text-[#6d6d6d]">
        {label}
      </span>
      {required && (
        <span className="shrink-0 text-xl font-semibold leading-[24px] text-[#d65856]">
          *
        </span>
      )}
    </div>
  );
}

function Row({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[40px] items-center gap-[16px]">
      <FieldLabel label={label} required={required} />
      {children}
    </div>
  );
}

export function BasicInfoTab() {
  return (
    <div className="flex w-full items-start gap-[24px]">
      <div className="flex flex-1 flex-col gap-[24px]">
        <div className={CARD_CLASS}>
          <p className={CARD_TITLE}>운영자 메모</p>
          <div className="flex flex-col gap-[16px]">
            {INFO_ROWS.map((row) => (
              <Row key={row.label} label={row.label}>
                <p className="flex-1 px-[12px] text-sm font-medium leading-[20px] text-black">
                  {row.value}
                </p>
              </Row>
            ))}
            <Row label="직책">
              <input
                type="text"
                placeholder="직책 입력"
                className="h-[40px] flex-1 rounded-[6px] border border-[#ebebeb] bg-white px-[13px] text-sm font-medium text-black outline-none placeholder:text-[#767676]"
              />
            </Row>
            <Row label="업종">
              <input
                type="text"
                placeholder="업종 입력"
                className="h-[40px] flex-1 rounded-[6px] border border-[#ebebeb] bg-white px-[13px] text-sm font-medium text-black outline-none placeholder:text-[#767676]"
              />
            </Row>
          </div>
        </div>

        <div className={CARD_CLASS}>
          <p className={CARD_TITLE}>운영자 메모</p>
          <textarea
            placeholder="해당 회원을 정지하려는 사유를 입력해주세요. 해당 회원을 정지하려는 사유를 입력해주세요."
            className="h-[162px] w-full resize-none rounded-[8px] border border-[#f2f2f2] bg-[#f0f0f3] p-[20px] text-base leading-[24px] tracking-[-0.32px] text-black outline-none placeholder:text-[#8f8f8f]"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col">
        <div className={CARD_CLASS}>
          <p className={CARD_TITLE}>사업자 등록 정보</p>
          <div className="flex flex-col gap-[16px]">
            <Row label="상태" required>
              <div className="flex h-[40px] flex-1 items-center justify-between rounded-[6px] border border-[#ebebeb] bg-[#cdcdcd] px-[13px]">
                <span className="text-sm font-medium text-[#767676]">미등록</span>
                <ChevronDown className="size-[16px] text-[#767676]" />
              </div>
            </Row>
            {BIZ_ROWS.map((row) => (
              <Row key={row.label} label={row.label} required={row.required}>
                <input
                  type="text"
                  disabled
                  placeholder={row.placeholder}
                  className="h-[40px] flex-1 rounded-[6px] border border-[#ebebeb] bg-[#cdcdcd] px-[13px] text-sm font-medium text-[#767676] outline-none placeholder:text-[#767676]"
                />
              </Row>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
