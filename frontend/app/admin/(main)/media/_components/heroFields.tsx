"use client";

import {
  ComboBox,
  Description,
  Input,
  Label,
  ListBox,
  Select,
  Tag,
  TagGroup,
} from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 어드민 매체 등록 화면의 HeroUI 입력 부품 — 값은 모두 문자열로 주고받는다(react-hook-form 값과 같은 모양).
 * 빈 값("")은 "선택 안 함"이다.
 */

export interface HeroOption {
  value: string;
  label: string;
}

// react-aria 선택 키는 빈 문자열을 쓸 수 없어 "선택 안 함"을 따로 둔다.
const NONE = "__none__";

export const HERO_ERROR_CLASS =
  "text-xs font-medium leading-[16px] text-[#d65856]";

/** 칸 틀 — 라벨(필수 *·덧붙임), 입력, 오류 또는 설명. */
export function HeroField({
  label,
  required,
  extra,
  help,
  error,
  wide,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  /** 라벨 옆에 흐리게 덧붙이는 말(예: 운영 시간 "(18시간)") */
  extra?: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** 두 칸 폭(긴 글·여러 개 고르기) */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-[6px]", wide && "col-span-2")}
    >
      <Label className="text-sm font-medium leading-[20px] text-[#2a2a2a]">
        {label}
        {required && <span className="text-[#d65856]"> *</span>}
        {extra && <span className="text-disabled"> {extra}</span>}
      </Label>
      {children}
      {error ? (
        <p className={HERO_ERROR_CLASS}>{error}</p>
      ) : (
        help && (
          <Description className="text-xs leading-[16px] text-disabled">
            {help}
          </Description>
        )
      )}
    </div>
  );
}

/** 하나 고르기 — HeroUI Select + ListBox. allowEmpty 면 맨 위에 "선택 안 함"(빈 값). */
export function HeroSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder = "선택해 주세요",
  emptyLabel = "미설정",
  allowEmpty = true,
  isDisabled,
  isInvalid,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: HeroOption[];
  placeholder?: string;
  emptyLabel?: string;
  allowEmpty?: boolean;
  isDisabled?: boolean;
  isInvalid?: boolean;
  ariaLabel: string;
}) {
  // 선택지에 없는 기존 값(정리 전 데이터)도 지우지 않고 보여 준다.
  const items =
    value && !options.some((o) => o.value === value)
      ? [{ value, label: `${value} (확인 필요)` }, ...options]
      : options;
  return (
    <Select
      variant="secondary"
      aria-label={ariaLabel}
      placeholder={placeholder}
      selectedKey={value || (allowEmpty ? NONE : null)}
      onSelectionChange={(key) =>
        onChange(key == null || key === NONE ? "" : String(key))
      }
      onBlur={onBlur}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      fullWidth
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {allowEmpty ? (
            <ListBox.Item key={NONE} id={NONE} textValue={emptyLabel}>
              <span className="text-disabled">{emptyLabel}</span>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ) : null}
          {items.map((o) => (
            <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * 고르거나 새로 입력 — HeroUI ComboBox(allowsCustomValue). 목록에서 고르거나, 없는 값은 그대로 적는다.
 * 카테고리·등급 산정 방식처럼 선택지가 지금 매체들의 값인 칸에 쓴다.
 */
export function HeroCombo({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
  isDisabled,
  isInvalid,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: string[];
  placeholder?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  ariaLabel: string;
}) {
  return (
    <ComboBox
      variant="secondary"
      aria-label={ariaLabel}
      allowsCustomValue
      allowsEmptyCollection
      menuTrigger="focus"
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key) => {
        if (key != null) onChange(String(key));
      }}
      onBlur={onBlur}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      fullWidth
    >
      <ComboBox.InputGroup>
        <Input variant="secondary" placeholder={placeholder} />
        <ComboBox.Trigger />
      </ComboBox.InputGroup>
      <ComboBox.Popover>
        <ListBox
          renderEmptyState={() => (
            <p className="px-[12px] py-[8px] text-sm text-disabled">
              목록에 없으면 그대로 입력하세요.
            </p>
          )}
        >
          {options.map((o) => (
            <ListBox.Item key={o} id={o} textValue={o}>
              {o}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </ComboBox.Popover>
    </ComboBox>
  );
}

/** 여러 개 고르기 — HeroUI TagGroup(selectionMode="multiple"). */
export function HeroTagMulti({
  values,
  onChange,
  options,
  isDisabled,
  ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: HeroOption[];
  isDisabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <TagGroup
      aria-label={ariaLabel}
      selectionMode="multiple"
      selectedKeys={new Set(values)}
      onSelectionChange={(keys) =>
        // 고른 순서가 아니라 선택지 순서로 맞춘다(저장 값이 늘 같은 순서가 되게).
        onChange(
          options
            .map((o) => o.value)
            .filter((v) => keys === "all" || keys.has(v)),
        )
      }
      disabledKeys={isDisabled ? options.map((o) => o.value) : undefined}
    >
      <TagGroup.List className="flex flex-wrap gap-[6px]">
        {options.map((o) => (
          <Tag key={o.value} id={o.value}>
            {o.label}
          </Tag>
        ))}
      </TagGroup.List>
    </TagGroup>
  );
}
