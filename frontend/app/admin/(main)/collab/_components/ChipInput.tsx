"use client";

import { Chip, CloseButton, Input, Tag, TagGroup } from "@heroui/react";
import { X } from "lucide-react";
import { useRef, useState } from "react";

import { HERO_ERROR_CLASS } from "@/app/admin/(main)/media/_components/heroFields";
import { cn } from "@/lib/utils";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

/** 칩 글자 정리 — 공백은 한 칸으로, 앞의 #은 뗀다(해시태그처럼 적어도 같은 값). */
const cleanChip = (raw: string) =>
  raw.split(/\s+/).join(" ").replace(/^#+/, "").trim();

/**
 * 칩 입력칸 — 적다가 쉼표(,)를 누르면 앞의 글이 칩으로 완성된다(2026-11-09 사용자). Enter · 칸을 벗어날 때도 칩이 된다.
 * 쉼표로 여러 개를 한 번에 붙여 넣어도 나눠 넣는다. 빈 칸에서 Backspace 는 마지막 칩을 지운다.
 * 매장 폼(매장 어필 · 조건 메모)과 매장 항목(유형별 값)이 같이 쓴다.
 */
export function ChipInput({
  values,
  onChange,
  ariaLabel,
  placeholder = "쉼표(,)로 구분해 입력",
  maxLength,
  prefix = "",
  colorOf,
  className,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
  placeholder?: string;
  /** 칩 한 개 글자 수 상한. */
  maxLength: number;
  /** 칩 앞에 붙여 보이는 글자 — 매장 어필은 "#". */
  prefix?: string;
  colorOf?: (value: string) => ChipColor;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 글 조각들을 칩으로 — 빈 것 · 이미 있는 것은 건너뛰고, 너무 길면 알려 준다. */
  const commit = (parts: string[]) => {
    let next = values;
    let message: string | null = null;
    for (const raw of parts) {
      const v = cleanChip(raw);
      if (!v || next.includes(v)) continue;
      if (v.length > maxLength) {
        message = `한 개에 ${maxLength}자까지 쓸 수 있어요.`;
        continue;
      }
      next = [...next, v];
    }
    if (next !== values) onChange(next);
    setError(message);
  };

  const remove = (v: string) => {
    onChange(values.filter((x) => x !== v));
    setError(null);
  };

  return (
    <div className={cn("flex flex-col gap-[6px]", className)}>
      {/* 칸 아무 데나 누르면 글 입력으로 — 칩과 입력이 한 상자 안에 있다. */}
      <div
        onClick={() => inputRef.current?.focus()}
        className={cn(
          // HeroUI 입력칸(Input variant="secondary")과 같은 바탕 토큰 — 다크 모드에서도 옆 칸과 같다.
          "flex min-h-[44px] w-full cursor-text flex-wrap items-center gap-[6px] rounded-[12px] border border-transparent bg-[var(--default)] px-[10px] py-[6px] transition-colors hover:bg-[var(--default-hover)] focus-within:border-primary focus-within:bg-[var(--default)]",
          error && "border-[#d65856] focus-within:border-[#d65856]",
        )}
      >
        {values.map((v) => (
          <Chip
            key={v}
            size="md"
            variant="soft"
            color={colorOf?.(v) ?? "accent"}
            className="gap-[2px] pr-[4px]"
          >
            {prefix}
            {v}
            <CloseButton
              aria-label={`${v} 지우기`}
              onPress={() => remove(v)}
              className="size-[18px] min-w-0 rounded-full bg-transparent p-0 text-current data-[hovered=true]:bg-black/10"
            >
              <X className="size-[11px]" />
            </CloseButton>
          </Chip>
        ))}
        {/* 상자가 입력칸 모양을 맡고, 안의 HeroUI Input 은 바탕 · 테두리 없이 글만 받는다. */}
        <Input
          ref={inputRef}
          aria-label={ariaLabel}
          value={draft}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => {
            const text = e.target.value;
            // 쉼표(전각 포함)를 만나면 그 앞까지를 칩으로, 뒤는 계속 적는 글로 남긴다.
            if (/[,，]/.test(text)) {
              const parts = text.split(/[,，]/);
              const rest = parts.pop() ?? "";
              commit(parts);
              setDraft(rest);
            } else {
              setDraft(text);
              if (error) setError(null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              commit([draft]);
              setDraft("");
            } else if (
              e.key === "Backspace" &&
              draft === "" &&
              values.length > 0
            ) {
              remove(values[values.length - 1]);
            }
          }}
          onBlur={() => {
            if (!draft.trim()) return;
            commit([draft]);
            setDraft("");
          }}
          className="h-[30px] min-w-[160px] flex-1 rounded-none border-0 bg-transparent! px-0 py-0 text-sm shadow-none! outline-none placeholder:text-disabled"
        />
      </div>
      {error && <p className={HERO_ERROR_CLASS}>{error}</p>}
    </div>
  );
}

/**
 * 유형별 값 — 매장 유형(매장 항목)에 정해 둔 칩을 눌러 넣고 뺀다(HeroUI TagGroup 여러 개 고르기). 들어간 것은 진하게.
 * 직접 적은 값(정해 둔 칩이 아닌 것)은 그대로 두고, 새로 고른 칩은 뒤에 붙인다.
 */
export function ChipPresets({
  label,
  options,
  values,
  onChange,
  prefix = "",
  empty,
}: {
  label: string;
  options: string[];
  values: string[];
  onChange: (next: string[]) => void;
  prefix?: string;
  /** 고를 값이 없을 때 안내. */
  empty?: string;
}) {
  if (!options.length)
    return empty ? <p className="text-xs text-disabled">{empty}</p> : null;
  return (
    <div className="flex flex-wrap items-center gap-[6px]">
      <span className="mr-[2px] text-xs text-disabled">{label}</span>
      <TagGroup
        aria-label={label}
        size="sm"
        selectionMode="multiple"
        selectedKeys={new Set(values.filter((v) => options.includes(v)))}
        onSelectionChange={(keys) => {
          const on = (o: string) => keys === "all" || keys.has(o);
          onChange([
            ...values.filter((v) => !options.includes(v) || on(v)),
            ...options.filter((o) => on(o) && !values.includes(o)),
          ]);
        }}
      >
        <TagGroup.List className="flex flex-wrap gap-[6px]">
          {options.map((o) => (
            <Tag key={o} id={o} textValue={`${prefix}${o}`}>
              {values.includes(o) ? "" : "+ "}
              {prefix}
              {o}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>
    </div>
  );
}
