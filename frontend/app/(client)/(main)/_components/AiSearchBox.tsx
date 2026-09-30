"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";

import { ArrowUpIcon } from "@/components/icons";

import { ModeToggle, type Mode } from "./ModeToggle";

const MAX_LENGTH = 500;
// 22px(leading) × 5줄. 여기부터는 더 늘리지 않고 스크롤한다.
const MAX_TEXTAREA_HEIGHT = 110;

export function AiSearchBox({
  value,
  onValueChange,
  mode,
  onModeChange,
  onAiSubmit,
}: {
  value: string;
  onValueChange: (value: string) => void;
  mode: Mode;
  /** AI/검색 전환 — 시안처럼 전송 버튼 왼쪽에 탭(ModeToggle)을 둔다. */
  onModeChange: (mode: Mode) => void;
  /** AI 모드 전송 — 홈에서 그대로 대화를 이어간다(페이지 이동 없음). */
  onAiSubmit: (text: string) => void;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 높이가 한 줄로 고정돼 있으면 두 줄째부터 옆에 스크롤바가 생긴다.
  // 내용만큼 늘려 주고(최대 5줄), 그 뒤로는 스크롤바 없이 스크롤만 되게 둔다.
  // 제안 문구 클릭처럼 부모가 값을 바꾸는 경우도 있어 value 변화를 따라간다.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const isEmpty = value.trim().length === 0;

  // AI 모드는 이 화면에서 바로 대화를 시작하고,
  // 검색 모드는 매체 찾기가 읽는 kw(매체명·주소 부분일치)로 넘긴다.
  // 빈 입력은 전송 버튼과 동일하게 Enter로도 막는다.
  const submit = () => {
    const text = value.trim();
    if (!text) return;
    if (mode === "search") {
      router.push(`/fixed?kw=${encodeURIComponent(text)}`);
      return;
    }
    onValueChange("");
    onAiSubmit(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    submit();
  };

  const isSearch = mode === "search";

  return (
    // 검색 모드는 테두리가 2px → 1px이라, 안쪽 모서리도 1px만큼 키워야 같은 두께로 둘린다.
    // 여백은 대화 입력바(HomeChat)와 같게 — 모바일 상하좌우 12px, PC는 탭·전송 버튼이
    // 테두리에서 8px, 글자는 왼쪽 16px·위 15px(오른쪽도 16px이 되게 textarea에 8px 더함).
    <div
      className="admix-ai-border w-full max-w-[860px] max-sm:flex max-sm:flex-col"
      data-mode={isSearch ? "search" : undefined}
    >
      {/* 모바일은 입력바가 세로로 커지므로 빈 곳을 눌러도 입력칸에 커서가 가게 한다. */}
      <div
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, [role='tab']"))
            return;
          textareaRef.current?.focus();
        }}
        className={`relative flex min-h-[140px] flex-col max-sm:flex-1 bg-white px-[12px] pt-[12px] pb-[12px] sm:min-h-[94px] sm:pt-[15px] sm:pr-[8px] sm:pb-[8px] sm:pl-[16px] ${
          isSearch ? "rounded-[26px]" : "rounded-[25px]"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) =>
            onValueChange(event.target.value.slice(0, MAX_LENGTH))
          }
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_LENGTH}
          aria-label="AI 믹시에게 질문하기"
          placeholder={
            isSearch
              ? "지역이나 매체명을 검색해 보세요"
              : "지역, 예산, 타겟, 광고 목적을 입력해 보세요"
          }
          className="max-h-[110px] w-full resize-none sm:pr-[8px] bg-transparent text-base leading-[24px] sm:text-[15px] sm:leading-[22px] text-black outline-none placeholder:text-[#a1a1aa] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        />

        {/* 시안: 전환 탭과 전송 버튼을 오른쪽 아래에 10px 간격으로 나란히 둔다. */}
        <div className="mt-auto flex items-center justify-end gap-[8px] pt-[4px] sm:gap-[10px] sm:pt-[8px]">
          <ModeToggle value={mode} onChange={onModeChange} />
          <Button
            isIconOnly
            variant="primary"
            size="sm"
            isDisabled={isEmpty}
            onPress={submit}
            aria-label={mode === "ai" ? "AI 믹시에게 보내기" : "매체 검색하기"}
            className="size-[36px] shrink-0 rounded-[15px] sm:size-[40px] sm:rounded-[17px]"
          >
            <ArrowUpIcon className="size-[18px] sm:size-[20px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
