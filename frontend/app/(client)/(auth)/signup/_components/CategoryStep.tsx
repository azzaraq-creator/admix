"use client";

import { Description, Label, Radio, RadioGroup, Tooltip } from "@heroui/react";
import { Fragment } from "react";

import { openMemberPlanModal } from "@/components/common/MemberPlanModal";
import { CircleQuestionIcon } from "@/components/icons";
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

/** 가입 화면 유형 묶음 — 일반 | 광고주 · 대행사 | 매체사 · 제휴사(콜라보). 묶음 사이에 구분선. */
const CATEGORY_GROUPS: MemberCategory[][] = [
  ["general"],
  ["advertiser", "agency"],
  ["media_owner", "partner"],
];

/** 고르면 다음 버튼 위 말풍선으로 알려 주는 유형. */
const CATEGORY_HINT: Partial<Record<MemberCategory, string>> = {
  general: "회원 유형은 나중에 변경할 수 있어요.",
};

/** 제휴사(콜라보) 이메일 가입 — 이메일 인증부터. */
export const PARTNER_SIGNUP_HREF = "/signup?category=partner";
/** 제휴사(콜라보) 기본협약 동의 — 가입 완료 화면의 "협약·매장 등록하기"로 간다. */
export const PARTNER_AGREEMENT_HREF = "/partners/join/agreement";

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
  const hint = value ? CATEGORY_HINT[value] : undefined;
  return (
    <SignupCard>
      <CardHeading
        title="회원 유형을 선택해 주세요"
        description="가입 후에도 회원 정보에서 언제든 회원 유형을 바꿀 수 있어요."
      />
      {/* 유형별로 쓸 수 있는 기능 — 플랜 비교 표 창. 아이콘 + 짧은 문구 알약. */}
      <button
        type="button"
        onClick={openMemberPlanModal}
        className="-mt-[8px] inline-flex items-center gap-[4px] self-start rounded-full bg-gray-100 py-[5px] pr-[10px] pl-[8px] text-[12px] font-semibold text-gray-600 transition-colors hover:bg-gray-200 max-sm:-mt-[4px]"
      >
        <CircleQuestionIcon aria-hidden className="size-[14px]" />
        유형 비교
      </button>

      <RadioGroup
        aria-label="회원 유형"
        value={value}
        onChange={(next) => {
          if (isMemberCategory(next)) onChange(next);
        }}
        // 라디오 색은 globals.css 대신 HeroUI 기본값(HEROUI_ACCENT_SCOPE)을 쓴다.
        className={`flex w-full flex-col gap-[12px] sm:gap-[14px] ${HEROUI_ACCENT_SCOPE}`}
      >
        {/* 한 줄에 한 유형씩 세로로 — 일반 | 광고주 · 대행사 | 매체사 · 제휴사(콜라보), 묶음 사이는 구분선. */}
        {CATEGORY_GROUPS.map((group, i) => (
          <Fragment key={group.join("-")}>
            {i > 0 && (
              <div
                role="separator"
                className="h-px w-full shrink-0 bg-gray-200"
              />
            )}
            <div className="flex w-full flex-col gap-[8px] sm:gap-[10px]">
              {group.map((value) => {
                const category = MEMBER_CATEGORIES.find(
                  (c) => c.value === value,
                );
                return category ? (
                  <CategoryCard key={value} category={category} />
                ) : null;
              })}
            </div>
          </Fragment>
        ))}
      </RadioGroup>

      {/* 일반 · 제휴사(콜라보)를 고르면 다음 버튼 바로 위에 HeroUI 툴팁으로 알려 준다
          (일반: 나중에 바꿀 수 있음. 제휴사 안내는 약관 동의 버튼 "협약·매장 등록하기"로 옮겼다).
          누르는 창이 아닌 안내라 Popover 대신 Tooltip — 마우스와 상관없이 고른 동안 열어 둔다(isOpen 고정).
          PC는 툴팁이 위 카드를 가리지 않게 자리를 미리 비워 둔다(고를 때 버튼이 밀리지 않게 항상). */}
      <div className="flex w-full flex-col max-sm:mt-auto sm:mt-[34px]">
        <Tooltip isOpen={!!hint} delay={0} closeDelay={0}>
          <PrimaryAction label="다음" disabled={!value} onPress={onNext} />
          <Tooltip.Content showArrow placement="top">
            <Tooltip.Arrow />
            {hint}
          </Tooltip.Content>
        </Tooltip>
      </div>
    </SignupCard>
  );
}

/** 회원 유형 카드(한 줄) — 왼쪽 라디오 · 이름, 오른쪽 끝 설명. 카드 전체를 누를 수 있게 Radio.Content를 카드 모양으로 만든다. */
function CategoryCard({
  category,
}: {
  category: (typeof MEMBER_CATEGORIES)[number];
}) {
  return (
    // HeroUI 세로 RadioGroup은 항목마다 위 여백을 준다 — 간격은 묶음(gap)이 맡으므로 없앤다.
    <Radio value={category.value} className="group mt-0 w-full">
      {/* 카드 높이 약 60px → 곡률 (60/2)-3 ≈ 16px(컨테이너라 시안 곡률 그대로). */}
      <Radio.Content className="flex w-full cursor-pointer items-center gap-[12px] rounded-[16px] border border-gray-200 bg-surface px-[16px] py-[12px] shadow-[0px_6px_10px_rgba(0,0,0,0.04)] transition-colors group-data-[selected=true]:border-gray-900 data-[hovered=true]:border-gray-300 group-data-[selected=true]:data-[hovered=true]:border-gray-900 max-sm:px-[14px] max-sm:py-[10px] sm:px-[20px] sm:py-[14px]">
        {/* 라디오 표시는 HeroUI 기본 스타일 — 맨 왼쪽. HeroUI 기본은 테두리 두께가 0이라 안 고른 원이 흰 카드에서 안 보여서 회색 테두리를 준다. */}
        <Radio.Control className="shrink-0 border-[1.5px] border-gray-300 group-data-[selected=true]:border-transparent">
          <Radio.Indicator />
        </Radio.Control>
        {/* PC는 이름 왼쪽 · 설명 오른쪽 끝, 모바일은 이름 아래 설명. */}
        <div className="flex min-w-0 flex-1 flex-col gap-[2px] sm:flex-row sm:items-baseline sm:justify-between sm:gap-[10px]">
          <Label className="shrink-0 cursor-pointer text-[16px] font-bold whitespace-nowrap text-gray-900 max-sm:text-[15px]">
            {category.label}
          </Label>
          {/* 설명은 한 줄로 이어 쓰되, 좁으면 단어 단위로 내려간다. */}
          <Description className="ps-0 text-[13px] sm:text-right leading-[1.5] break-keep text-gray-500 max-sm:text-[12px]">
            {category.description.join(" ")}
          </Description>
        </div>
      </Radio.Content>
    </Radio>
  );
}
