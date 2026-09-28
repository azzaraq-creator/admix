"use client";

import { Description, Label, Radio, RadioGroup } from "@heroui/react";

import {
  MEMBER_CATEGORIES,
  isMemberCategory,
  type MemberCategory,
} from "@/lib/memberCategory";

import {
  CardHeading,
  HEROUI_ACCENT_SCOPE,
  PrimaryAction,
  SignupCard,
} from "./signupUi";

/**
 * 1단계 — 시안(00. 회원가입 - 회원 유형 선택).
 * HeroUI RadioGroup/Radio 구조 그대로: Radio.Content(누르는 영역) 안에 Label·Description·Radio.Control.
 * 시안처럼 카드 전체를 누를 수 있게 Radio.Content를 카드 모양으로 만든다.
 */
export function CategoryStep({
  value,
  onChange,
  onNext,
}: {
  value: MemberCategory | null;
  onChange: (next: MemberCategory) => void;
  onNext: () => void;
}) {
  return (
    <SignupCard>
      <CardHeading
        title="회원 유형을 선택해 주세요"
        description="선택한 유형에 따라 필요한 정보와 이용 가능한 기능이 달라집니다."
      />

      <RadioGroup
        aria-label="회원 유형"
        value={value}
        onChange={(next) => {
          if (isMemberCategory(next)) onChange(next);
        }}
        // 기본은 세로 한 줄 — 시안의 2×2 배치로 바꾼다.
        // 라디오 색은 globals.css 대신 HeroUI 기본값(HEROUI_ACCENT_SCOPE)을 쓴다.
        className={`grid w-full grid-cols-2 gap-[12px] sm:gap-[16px] ${HEROUI_ACCENT_SCOPE}`}
      >
        {MEMBER_CATEGORIES.map((category) => (
          <Radio
            key={category.value}
            value={category.value}
            className="group w-full"
          >
            {/* 카드(148px)는 컨테이너라 시안 곡률 16px을 그대로 둔다. */}
            <Radio.Content className="grid h-[148px] w-full cursor-pointer grid-cols-[1fr_auto] content-start gap-x-[8px] gap-y-[10px] rounded-[16px] border border-black-200 bg-white p-[16px] shadow-[0px_10px_12px_rgba(0,0,0,0.05)] transition-colors group-data-[selected=true]:border-primary-200 group-data-[selected=true]:bg-primary-50 group-data-[selected=true]:shadow-[0px_10px_10px_rgba(163,59,209,0.1)] data-[hovered=true]:border-black-300 sm:p-[20px]">
              <Label className="cursor-pointer text-[16px] font-bold whitespace-nowrap text-black-900">
                {category.label}
              </Label>
              {/* 라디오 표시는 HeroUI 기본 스타일 그대로 쓴다. */}
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Description className="col-span-2 ps-0 text-[13px] leading-[1.5] text-black-500">
                {category.description.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </Description>
            </Radio.Content>
          </Radio>
        ))}
      </RadioGroup>

      <PrimaryAction
        label="다음"
        note="가입 유형은 가입 후에도 회원 정보에서 변경 요청할 수 있습니다."
        disabled={!value}
        onPress={onNext}
      />
    </SignupCard>
  );
}
