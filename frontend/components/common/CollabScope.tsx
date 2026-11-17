"use client";

import { Label, Radio, RadioGroup } from "@heroui/react";

import { HEROUI_ACCENT_SCOPE } from "@/app/(client)/(auth)/signup/_components/signupUi";
import {
  COLLAB_SCOPE_ITEMS,
  COLLAB_SCOPE_VALUE_LABEL,
  COLLAB_SCOPE_VALUES,
  SCOPE_TONE_CHIP,
  scopeEntries,
  type CollabScope,
  type CollabScopeValue,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

/**
 * 가능 범위 고르기(2026-11-17 사용자: 조건 메모 대신 "유형마다 radio로 가능, 불가능") — 항목마다 칸 하나, 칸 안에 이름 · 예시와 가능 · 불가능.
 * 고르지 않은 항목은 비워 둔다. 어드민 매장 폼 · 영업 기록 매장 정보 · 내 매장 수정 요청 창이 같이 쓴다.
 * 11-17 사용자: 처음엔 최대 560px 한 줄 목록이라 넓은 칸에서 구분선이 중간에 끊겨 "잘린 것처럼 보이잖아!" →
 *   놓인 칸 너비(@container)에 맞춰 칸을 1 · 2 · 3열로 채운다(어드민 넓은 칸 3열, 수정 요청 창 2열, 휴대폰 1열).
 *   고른 칸은 가능 초록 · 불가능 빨강으로 옅게 물든다(칩 SCOPE_TONE_CHIP 과 같은 색).
 */
const SCOPE_TONE_CARD: Record<CollabScopeValue, string> = {
  ok: "border-emerald-200 bg-emerald-50/60 dark:border-success/30 dark:bg-success-bg",
  no: "border-red-200 bg-red-50/60 dark:border-error/30 dark:bg-error-bg",
};

export function CollabScopeRadios({
  value,
  onChange,
  className,
}: {
  value: CollabScope;
  onChange: (next: CollabScope) => void;
  className?: string;
}) {
  return (
    <div className={cn("@container w-full", className)}>
      <ul
        className={cn(
          "grid grid-cols-1 gap-[8px] @md:grid-cols-2 @4xl:grid-cols-3",
          HEROUI_ACCENT_SCOPE,
        )}
      >
        {COLLAB_SCOPE_ITEMS.map((it) => {
          const picked = value[it.key];
          return (
            <li
              key={it.key}
              className={cn(
                "flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[10px] rounded-[14px] border px-[14px] py-[12px] transition-colors",
                picked ? SCOPE_TONE_CARD[picked] : "border-gray-200 bg-surface",
              )}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold break-keep text-gray-900">
                  {it.label}
                </span>
                <span className="text-xs break-keep text-gray-500">
                  {it.desc}
                </span>
              </div>
              <RadioGroup
                aria-label={it.label}
                orientation="horizontal"
                // 회색 동그라미(입력칸과 같은 secondary) — 흰 바탕에서도 고르지 않은 칸이 보이게.
                variant="secondary"
                value={picked ?? null}
                onChange={(v) =>
                  onChange({ ...value, [it.key]: v as CollabScopeValue })
                }
                className="flex shrink-0 flex-row gap-[14px]"
              >
                {COLLAB_SCOPE_VALUES.map((v) => (
                  <Radio key={v} value={v} className="mt-0">
                    <Radio.Content className="flex cursor-pointer items-center gap-[6px]">
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <Label className="cursor-pointer text-sm text-gray-700">
                        {COLLAB_SCOPE_VALUE_LABEL[v]}
                      </Label>
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 가능 범위 칩 — 고른 항목만 "브랜딩 제작물 가능"처럼(가능 초록 · 불가능 빨강). 고른 게 없으면 그리지 않는다. */
export function CollabScopeChips({
  scope,
  className,
}: {
  scope: CollabScope | null | undefined;
  className?: string;
}) {
  const entries = scopeEntries(scope);
  if (!entries.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-[4px]", className)}>
      {entries.map((e) => (
        <span
          key={e.key}
          className={cn(
            "rounded-[8px] px-[7px] text-[12px] leading-[22px] font-semibold break-keep",
            SCOPE_TONE_CHIP[e.value],
          )}
        >
          {e.label} {COLLAB_SCOPE_VALUE_LABEL[e.value]}
        </span>
      ))}
    </span>
  );
}
