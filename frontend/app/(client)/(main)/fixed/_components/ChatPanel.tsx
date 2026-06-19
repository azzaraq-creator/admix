"use client";

import { useRef, useState } from "react";

import { MediaFilterBar } from "@/components/common/MediaFilterBar";
import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import { ArrowUpIcon, SparkleIcon } from "@/components/icons";
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { ModeToggle, type Mode } from "../../_components/ModeToggle";

const FAQS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
];

const SEARCH_RESULTS: MediaItemData[] = [
  { id: "s1", name: "홍대입구역 스타피카소 전광판", price: "최소집행금액 1,500만원 / 한달" },
  { id: "s2", name: "홍대입구역 아트 래핑", price: "최소집행금액 1,500만원 / 한달", popular: true },
  { id: "s3", name: "홍대입구역 상진빌딩 전광판", price: "최소집행금액 1,500만원 / 한달", popular: true },
];

const MAX_LENGTH = 500;
const MAX_TEXTAREA_HEIGHT = 120;

export function ChatPanel({
  onSelectMedia,
  selectedId,
}: {
  onSelectMedia?: (item: MediaItemData) => void;
  selectedId?: string;
}) {
  const [mode, setMode] = useState<Mode>("ai");
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  };

  const setText = (text: string) => {
    setValue(text.slice(0, MAX_LENGTH));
    requestAnimationFrame(resize);
  };

  const fillFromFaq = (text: string) => {
    setText(text);
    textareaRef.current?.focus();
  };

  return (
    <div className="flex h-full w-full shrink-0 flex-col border-r border-[#e8e8e8] bg-white sm:w-[384px]">
      <div className="flex flex-col gap-[16px] border-b border-stroke px-[16px] py-[24px]">
        <ModeToggle className="w-full" value={mode} onChange={setMode} />
        {mode === "search" && (
          <LocationSearchInput
            value={location}
            onChange={setLocation}
            className="w-full"
          />
        )}
      </div>

      {mode === "search" && <MediaFilterBar />}

      <div className="flex flex-1 flex-col overflow-y-auto">
        {mode === "ai" ? (
          <div className="flex min-h-full flex-col justify-between gap-[24px] p-[24px]">
            <div className="flex flex-col gap-[12px]">
              <SparkleIcon className="size-[24px] text-primary" />
              <div className="text-[24px] font-medium leading-[32px] tracking-[-0.1px] text-black">
                <p>안녕하세요!</p>
                <p>
                  AI 추천 <span className="font-semibold text-primary">믹시</span>
                  에요.
                </p>
                <p>조건에 딱 맞는 추천을 해드릴게요.</p>
              </div>
            </div>

            <div className="flex flex-col gap-[8px]">
              <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
                자주 물어보는 질문이에요.
              </p>
              <div className="flex flex-col gap-[8px]">
                {FAQS.map((faq) => (
                  <button
                    key={faq}
                    type="button"
                    onClick={() => fillFromFaq(faq)}
                    className="flex w-full items-start gap-[10px] rounded-[12px] border border-[#f0f5f9] bg-[#f9fafc] px-[16px] py-[12px] text-left transition-colors hover:bg-[#f1f5f9]"
                  >
                    <SparkleIcon className="size-[24px] shrink-0 text-primary" />
                    <span className="flex-1 text-base font-medium leading-[24px] text-black">
                      {faq}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col">
            {SEARCH_RESULTS.map((item) => (
              <MediaItem
                key={item.id}
                {...item}
                selected={item.id === selectedId}
                onClick={() => onSelectMedia?.(item)}
                className="rounded-none border-0 border-b"
              />
            ))}
          </div>
        )}
      </div>

      {mode === "ai" && (
        <div className="flex flex-col items-center gap-[10px] px-[24px] pb-[24px] pt-[8px]">
          <div className="flex w-full items-center gap-[12px] rounded-[24px] border border-primary bg-white px-[24px] py-[10px]">
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              maxLength={MAX_LENGTH}
              onChange={(event) => setText(event.target.value)}
              placeholder="매체 조건을 입력하세요"
              className="max-h-[120px] flex-1 resize-none bg-transparent text-base font-medium leading-[24px] text-black outline-none placeholder:text-[#757575]"
            />
            <button
              type="button"
              disabled={value.trim().length === 0}
              aria-label="전송"
              className="flex shrink-0 items-center justify-center rounded-full bg-primary p-[8px] text-white disabled:opacity-50"
            >
              <ArrowUpIcon className="size-[18px]" />
            </button>
          </div>
          <p className="w-full text-center text-xs font-medium leading-[16px] text-[#757575]">
            AI 학습 데이터 기반의 답변으로, 실제와 차이가 있을 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
