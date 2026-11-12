"use client";

import {
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  Label,
  Separator,
} from "@heroui/react";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import type { HelpTabKey } from "../../../(main)/help/content";

import { TermsModal } from "./TermsModal";
import { SmallChevronRightIcon } from "./signupIcons";
import {
  CardHeading,
  CollabMarketingNote,
  FieldMessage,
  HEROUI_CHECKBOX_SCOPE,
  PrimaryAction,
  RADIUS,
  SignupCard,
} from "./signupUi";

// 약관 항목은 기존 가입 화면과 같다. "보기"는 /help와 같은 내용을 Modal로 띄운다.
const REQUIRED_TERMS: { key: string; label: string; tab?: HelpTabKey }[] = [
  { key: "age", label: "만 14세 이상입니다." },
  { key: "tos", label: "서비스 이용약관 동의", tab: "terms" },
  { key: "privacy", label: "개인정보 처리방침 동의", tab: "privacy" },
  { key: "location", label: "위치기반 서비스 이용약관 동의", tab: "location" },
];
const MARKETING_KEY = "marketing";
/** 마케팅 정보 받을 방법(083) — 제휴사 가입에서만 고른다(11-12 사용자, 콜라보 내 정보와 같은 문구 · 체크박스). */
export interface MarketingChannels {
  sms: boolean;
  email: boolean;
}
const CHANNELS = [
  ["sms", "SMS"],
  ["email", "이메일"],
] as const;
const ALL_CHANNELS = CHANNELS.map(([key]) => key as string);
/** 전체 동의도 그룹 안의 체크박스다 — 이 값이 들어 있으면 "모두 체크됨". */
const ALL_KEY = "all";
const ITEM_KEYS = [...REQUIRED_TERMS.map((term) => term.key), MARKETING_KEY];

/**
 * CheckboxGroup 값 변화를 전체 동의와 개별 항목 규칙에 맞게 정리한다.
 * - 전체 동의를 켜면 모두 체크, 끄면 모두 해제
 * - 개별 항목을 바꾸면 전부 체크됐을 때만 전체 동의가 켜진다
 */
function nextSelection(prev: string[], next: string[]): string[] {
  const hadAll = prev.includes(ALL_KEY);
  const hasAll = next.includes(ALL_KEY);
  if (!hadAll && hasAll) return [ALL_KEY, ...ITEM_KEYS];
  if (hadAll && !hasAll) return [];
  const items = next.filter((key) => key !== ALL_KEY);
  return items.length === ITEM_KEYS.length ? [ALL_KEY, ...items] : items;
}

/**
 * HeroUI CheckboxGroup은 그룹 라벨 아래 배치를 전제로 안의 체크박스마다 위 여백(mt-4, 16px)을 준다.
 * 이 화면은 간격을 직접 잡으므로(항목 사이 12px 등) 그 여백을 없앤다.
 */
const NO_GROUP_MARGIN = "mt-0";

/**
 * 아래 항목의 체크박스를 "전체 동의" 박스 안 체크박스와 같은 세로줄에 맞춘다.
 * 전체 동의 박스의 좌우 여백 16px + 테두리 1px = 17px.
 */
const ALIGN_WITH_ALL = "px-[17px]";

/** 체크 표시(Control)는 HeroUI 기본 스타일에 테두리만 진하게 하고, 옆 글자 배치를 잡는다. */
function TermCheckboxBody({
  align = "center",
  children,
}: {
  align?: "center" | "start";
  children: ReactNode;
}) {
  return (
    <Checkbox.Content
      className={cn(
        "w-full gap-[12px]",
        align === "start" ? "items-start" : "items-center",
      )}
    >
      {/* HeroUI 기본 체크박스 그대로 두고, 흰 바탕에서 잘 보이게 옅은 회색 테두리(1px)만 더한다.
          (기본 테두리는 두께 0이라 그림자로만 구분된다.) 켜짐·부분 선택일 땐 테두리도 채움색으로, 켜짐은 바탕까지 채워
          테두리 안쪽 모서리에 흰 틈이 보이지 않게 한다. */}
      <Checkbox.Control className="border border-gray-300 in-data-[indeterminate=true]:border-accent in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
        <Checkbox.Indicator />
      </Checkbox.Control>
      {children}
    </Checkbox.Content>
  );
}

/** 필수/선택 배지(18px → 곡률 6px). */
function TermBadge({ required }: { required: boolean }) {
  return (
    <Chip
      className={cn(
        "h-[18px] px-[7px] py-0 text-[10px] font-semibold",
        RADIUS.h18,
        required ? "bg-gray-600 text-gray-50" : "bg-tone-ededef text-zinc-500",
      )}
    >
      {required ? "필수" : "선택"}
    </Chip>
  );
}

/**
 * 5단계 — 시안(00. 회원가입 - 약관동의).
 * 전체 동의·필수 4개·선택 1개를 HeroUI CheckboxGroup 하나로 묶는다.
 * 제휴사(partner) 가입이면 마케팅 동의 설명이 새 콜라보 알림으로 바뀌고, 그 아래 받을 방법(SMS · 이메일, 둘 다 가능)을 고른다.
 */
export function TermsStep({
  pending,
  error,
  partner = false,
  onSubmit,
}: {
  pending: boolean;
  error: string;
  partner?: boolean;
  /** channels — 제휴사 가입에서 마케팅에 동의했을 때만 넘긴다. */
  onSubmit: (marketingConsent: boolean, channels?: MarketingChannels) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  // 받을 방법 — 처음엔 둘 다. 마케팅 동의가 꺼져 있으면 흐리게 막고 빈 칸으로 보인다.
  const [channels, setChannels] = useState<string[]>(ALL_CHANNELS);
  const [channelError, setChannelError] = useState("");
  /** "보기"로 연 약관(HeroUI Modal). */
  const [openTerm, setOpenTerm] = useState<HelpTabKey | null>(null);

  const itemCount = selected.filter((key) => key !== ALL_KEY).length;
  const someChecked = itemCount > 0 && itemCount < ITEM_KEYS.length;
  const requiredDone = REQUIRED_TERMS.every((term) =>
    selected.includes(term.key),
  );
  const marketing = selected.includes(MARKETING_KEY);

  const changeSelection = (next: string[]) => {
    const resolved = nextSelection(selected, next);
    // 마케팅 동의를 다시 켰는데 받을 방법을 모두 꺼 뒀으면 둘 다로 되돌린다.
    if (!marketing && resolved.includes(MARKETING_KEY) && !channels.length)
      setChannels(ALL_CHANNELS);
    setChannelError("");
    setSelected(resolved);
  };

  const submit = () => {
    if (!partner || !marketing) return onSubmit(marketing);
    if (!channels.length) {
      setChannelError("SMS나 이메일 중 하나는 골라 주세요.");
      return;
    }
    onSubmit(true, {
      sms: channels.includes("sms"),
      email: channels.includes("email"),
    });
  };

  const submitButton = (
    <PrimaryAction
      label="가입 완료"
      note="필수 약관에 모두 동의해야 가입을 완료할 수 있어요"
      disabled={!requiredDone}
      pending={pending}
      onPress={submit}
    />
  );

  return (
    <SignupCard>
      <CardHeading
        title="약관에 동의해 주세요"
        description="서비스 이용을 위해 아래 약관을 확인해주세요."
      />

      <CheckboxGroup
        aria-label="약관 동의"
        value={selected}
        onChange={changeSelection}
        // 체크박스는 globals.css 대신 HeroUI 기본 색·곡률(HEROUI_CHECKBOX_SCOPE)을 쓴다.
        className={cn("flex w-full flex-col gap-[16px]", HEROUI_CHECKBOX_SCOPE)}
      >
        {/* 전체 동의 — 일부만 체크되면 HeroUI 부분 선택(−) 표시.
            줄은 컨테이너(약 64px)라 시안 곡률 12px을 그대로 둔다. */}
        <div
          className={cn(
            "flex w-full rounded-[12px] border px-[16px] py-[14px]",
            itemCount === 0
              ? "border-gray-200 bg-surface"
              : "border-primary-200 bg-primary-50",
          )}
        >
          <Checkbox
            value={ALL_KEY}
            isIndeterminate={someChecked}
            className={cn("min-w-0 flex-1", NO_GROUP_MARGIN)}
          >
            <TermCheckboxBody>
              <span className="flex flex-col gap-[2px]">
                <Label className="text-[15px] font-bold text-gray-900">
                  전체 동의
                </Label>
                <span className="text-[11px] leading-[1.4] text-gray-500">
                  모든 약관 및 마케팅 정보 수신에 동의합니다.
                </span>
              </span>
            </TermCheckboxBody>
          </Checkbox>
        </div>

        <Separator className="bg-tone-ececef" />

        <div className={cn("flex w-full flex-col gap-[12px]", ALIGN_WITH_ALL)}>
          {REQUIRED_TERMS.map((term) => (
            <div key={term.key} className="flex w-full items-center gap-[8px]">
              <Checkbox
                value={term.key}
                className={cn("min-w-0 flex-1", NO_GROUP_MARGIN)}
              >
                <TermCheckboxBody>
                  <span className="flex min-w-0 items-center gap-[8px]">
                    <TermBadge required />
                    <Label className="truncate text-[13px] font-semibold text-gray-900">
                      {term.label}
                    </Label>
                  </span>
                </TermCheckboxBody>
              </Checkbox>
              {term.tab && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`${term.label} 전문 보기`}
                  onPress={() => setOpenTerm(term.tab ?? null)}
                  className="h-auto min-w-0 shrink-0 gap-[1px] p-0 text-[11px] font-normal text-zinc-400 data-[hovered=true]:bg-transparent data-[hovered=true]:text-gray-600"
                >
                  보기
                  <SmallChevronRightIcon className="size-[10px]" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <Separator className="bg-tone-ececef" />

        <Checkbox
          value={MARKETING_KEY}
          className={cn("w-full", NO_GROUP_MARGIN, ALIGN_WITH_ALL)}
        >
          <TermCheckboxBody align="start">
            <span className="flex flex-col gap-[2px]">
              <span className="flex items-center gap-[8px]">
                <TermBadge required={false} />
                <Label className="text-[13px] font-semibold text-gray-900">
                  마케팅 정보 수신 동의
                </Label>
              </span>
              {!partner && (
                <span className="text-[12px] text-gray-400">
                  신규 매체, 이벤트 및 서비스 소식을 받아보실 수 있어요
                </span>
              )}
            </span>
          </TermCheckboxBody>
        </Checkbox>

        {/* 제휴사 — 새 콜라보 알림 안내(눈에 띄게, 11-12 사용자). 체크박스 밖이라 눌러도 동의가 바뀌지 않는다. 글자 줄(17 + 16 + 12px)에 맞춘다. */}
        {partner && <CollabMarketingNote className="-mt-[8px] ml-[45px]" />}

        {/* 제휴사 — 받을 방법(SMS · 이메일). 약관 그룹과 값이 섞이지 않게 따로 묶는다. */}
        {partner && (
          <CheckboxGroup
            aria-label="마케팅 정보 받을 방법"
            value={marketing ? channels : []}
            onChange={(next) => {
              setChannels(next);
              setChannelError("");
            }}
            isDisabled={!marketing}
            className="-mt-[6px] flex flex-row flex-wrap gap-x-[16px] gap-y-[6px] pl-[45px]"
          >
            {CHANNELS.map(([key, label]) => (
              <Checkbox key={key} value={key} className={NO_GROUP_MARGIN}>
                {/* 약관 줄과 같은 체크 표시 — 다만 폭은 글자만큼(w-full 이면 한 줄에 하나씩 쌓인다). */}
                <Checkbox.Content className="items-center gap-[8px]">
                  <Checkbox.Control className="border border-gray-300 in-data-[selected=true]:border-accent in-data-[selected=true]:bg-accent">
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Label className="text-[13px] font-medium text-gray-900">
                    {label}
                  </Label>
                </Checkbox.Content>
              </Checkbox>
            ))}
          </CheckboxGroup>
        )}
      </CheckboxGroup>

      {channelError && <FieldMessage tone="error">{channelError}</FieldMessage>}
      {error && <FieldMessage tone="error">{error}</FieldMessage>}

      <TermsModal tab={openTerm} onClose={() => setOpenTerm(null)} />

      {submitButton}
    </SignupCard>
  );
}
