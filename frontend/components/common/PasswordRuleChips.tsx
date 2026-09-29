"use client";

import { Chip } from "@heroui/react";

import { SmallCheckIcon, SmallXIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** 비밀번호 조건 — 회원가입·비밀번호 변경이 같이 쓴다. */
export const PASSWORD_RULES = [
  { label: "영문", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "숫자", test: (v: string) => /\d/.test(v) },
  { label: "특수문자", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
  { label: "8자 이상", test: (v: string) => v.length >= 8 },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/** 비밀번호 조건 칩(24px → 곡률 9px) — 입력 전엔 회색, 맞으면 초록 체크, 틀리면 빨간 X. */
export function RuleChip({
  label,
  state,
}: {
  label: string;
  state: "idle" | "ok" | "fail";
}) {
  return (
    <Chip
      className={cn(
        "h-[24px] gap-[4px] rounded-[9px] py-0 pr-[10px] pl-[8px] text-[11px] font-medium",
        state === "ok" && "bg-[#f0fdf4] text-[#16a34a]",
        state === "fail" && "bg-[#fef2f2] text-[#dc2626]",
        state === "idle" && "bg-[#f4f4f5] text-[#a1a1aa]",
      )}
    >
      {state === "fail" ? (
        <SmallXIcon className="size-[10px]" />
      ) : (
        <SmallCheckIcon className="size-[10px]" />
      )}
      {label}
    </Chip>
  );
}

/** 입력한 비밀번호가 조건마다 맞는지 칩으로 보여 준다. */
export function PasswordRuleChips({
  password,
  className,
}: {
  password: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-[8px]", className)}>
      {PASSWORD_RULES.map((rule) => (
        <RuleChip
          key={rule.label}
          label={rule.label}
          state={password ? (rule.test(password) ? "ok" : "fail") : "idle"}
        />
      ))}
    </div>
  );
}
