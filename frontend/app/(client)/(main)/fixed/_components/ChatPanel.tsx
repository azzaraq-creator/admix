"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { MediaItem, type MediaItemData } from "@/components/common/MediaItem";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  RotateCwIcon,
  SparkleIcon,
} from "@/components/icons";
import { LocationSearchInput } from "../../_components/LocationSearchInput";
import { ModeToggle, type Mode } from "../../_components/ModeToggle";

const FAQS = [
  "강남에서 빌보드 광고 1억 예산으로 화장품 브랜딩하고 싶어요",
  "홍대에서 5,000만원 예산으로 광고 매체를 추천받고 싶어요",
  "잠실역에서 20대 여성을 타겟한 인기 광고 매체를 추천받고 싶어요",
];

const SEARCH_FILTERS = [
  "카테고리",
  "가격 범위",
  "매체 판매 유형",
  "매체 타입",
  "설치 장소",
  "매체 형태",
];

const SEARCH_RESULTS: MediaItemData[] = [
  { id: "s1", name: "홍대입구역 스타피카소 전광판", price: "최소집행금액 1,500만원 / 한달" },
  { id: "s2", name: "홍대입구역 아트 래핑", price: "최소집행금액 1,500만원 / 한달", popular: true },
  { id: "s3", name: "홍대입구역 상진빌딩 전광판", price: "최소집행금액 1,500만원 / 한달", popular: true },
];

const MAX_LENGTH = 500;
const MAX_TEXTAREA_HEIGHT = 120;

export function ChatPanel() {
  const [mode, setMode] = useState<Mode>("ai");
  const [value, setValue] = useState("");
  const [location, setLocation] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const filterDrag = useRef({ active: false, startX: 0, startScroll: 0, moved: false });

  const onFilterPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = filterRef.current;
    if (!el) return;
    filterDrag.current = {
      active: true,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    el.setPointerCapture(event.pointerId);
  };

  const onFilterPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = filterRef.current;
    if (!el || !filterDrag.current.active) return;
    const dx = event.clientX - filterDrag.current.startX;
    if (Math.abs(dx) > 3) filterDrag.current.moved = true;
    el.scrollLeft = filterDrag.current.startScroll - dx;
  };

  const onFilterPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    filterDrag.current.active = false;
    filterRef.current?.releasePointerCapture(event.pointerId);
  };

  const onFilterClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (filterDrag.current.moved) {
      event.preventDefault();
      event.stopPropagation();
      filterDrag.current.moved = false;
    }
  };

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
    <div className="flex h-screen w-[384px] shrink-0 flex-col border-r border-[#e8e8e8] bg-white">
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

      {mode === "search" &&
        (filtersOpen ? (
          <div className="flex flex-col gap-[16px] border-b border-stroke bg-white pt-[12px] drop-shadow-[0px_4px_2px_rgba(0,0,0,0.16)]">
            <div className="flex flex-col gap-[6px] px-[16px] py-[2px]">
              {[0, 2, 4].map((start) => (
                <div key={start} className="flex gap-[6px]">
                  {SEARCH_FILTERS.slice(start, start + 2).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      className="flex flex-1 items-center justify-center rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-[#f6f6f6] px-[16px] py-[12px]">
              <button
                type="button"
                className="flex items-center gap-[4px] rounded-[8px] border border-primary bg-white px-[12px] py-[8px] text-sm font-medium text-primary"
              >
                <RotateCwIcon className="size-[18px]" />
                초기화
              </button>
              <button
                type="button"
                aria-label="필터 접기"
                onClick={() => setFiltersOpen(false)}
                className="flex items-center rounded-full border border-stroke p-[6px] text-black"
              >
                <ChevronDownIcon className="size-[24px] rotate-180" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-[16px] border-b border-stroke py-[12px]">
            <div
              ref={filterRef}
              onPointerDown={onFilterPointerDown}
              onPointerMove={onFilterPointerMove}
              onPointerUp={onFilterPointerUp}
              onPointerCancel={onFilterPointerUp}
              onClickCapture={onFilterClickCapture}
              className="flex flex-1 cursor-grab items-center gap-[6px] overflow-x-auto px-[16px] select-none [scrollbar-width:none] active:cursor-grabbing [&::-webkit-scrollbar]:hidden"
            >
              <button
                type="button"
                className="flex shrink-0 items-center gap-[4px] rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
              >
                <RotateCwIcon className="size-[18px]" />
                초기화
              </button>
              {SEARCH_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  className="shrink-0 whitespace-nowrap rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="pr-[16px]">
              <button
                type="button"
                aria-label="필터 펼치기"
                onClick={() => setFiltersOpen(true)}
                className="flex items-center rounded-full border border-stroke p-[6px] text-black"
              >
                <ChevronDownIcon className="size-[24px]" />
              </button>
            </div>
          </div>
        ))}

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
