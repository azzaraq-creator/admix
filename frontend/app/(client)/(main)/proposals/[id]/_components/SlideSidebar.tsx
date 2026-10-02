"use client";

import { Button, ScrollShadow } from "@heroui/react";
import Image from "next/image";
import { Fragment, type ReactNode, useState } from "react";

import { TrashOutlineIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { Slide } from "./SlideLightbox";

/**
 * 제안서 슬라이드 목록 — 시안 "03. 제안서 - 상세 (제출 전)" 왼쪽 열(197px).
 * 번호 + 150×95 썸네일 카드(안쪽 140×67 미리보기, 아래 이름). 고정 슬라이드(표지·서머리 / THANK YOU)와
 * 매체 슬라이드 사이엔 구분선. 매체 슬라이드는 ::: 손잡이를 누른 채 끌어 순서를 바꾸고(놓으면 바로 저장되고
 * 서머리 순서에도 반영), 썸네일 오른쪽 위 휴지통으로 뺀다.
 * 맨 아래 "관심 매체에서 추가하기".
 */
export function SlideSidebar({
  slides,
  firstMediaIndex,
  locked,
  selectedId,
  onSelect,
  onReorder,
  onDeleteSlide,
  renderThumb,
  onAddFromFavorites,
}: {
  slides: Slide[];
  firstMediaIndex: number;
  locked: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDeleteSlide: (slideNumber: number, mediaId: string, name: string) => void;
  renderThumb: (slide: Slide) => ReactNode;
  onAddFromFavorites: () => void;
}) {
  const lastIndex = slides.length - 1;
  // 끌기는 ::: 손잡이를 누른 줄에서만 시작한다(armed). 끄는 중인 줄(from)과 놓일 자리(over)로 표시를 그린다.
  const [armed, setArmed] = useState<number | null>(null);
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const resetDrag = () => {
    setArmed(null);
    setFrom(null);
    setOver(null);
  };

  return (
    <aside className="flex w-[197px] shrink-0 flex-col border-r border-[#e5e7eb]">
      {/* 세로 스크롤바가 자리를 차지하는 환경(스크롤 막대 항상 보기·마우스 연결)에서도 가로 스크롤이
          생기지 않게 가로 넘침은 숨기고, 썸네일 카드는 남는 폭에 맞춰 줄어든다(최대 150px).
          슬라이드가 많아 넘치면 넘치는 쪽 가장자리를 흐리게(HeroUI ScrollShadow) 한다. */}
      <ScrollShadow
        size={24}
        className="flex min-h-0 flex-1 flex-col gap-[10px] overflow-x-hidden p-[10px] [scrollbar-width:thin]"
      >
        {slides.map((slide, index) => {
          const isFixed = index < firstMediaIndex || index === lastIndex;
          const canEdit = !isFixed && !locked;
          const selected = selectedId === slide.id;
          const showDivider =
            index === firstMediaIndex ||
            (index === lastIndex && lastIndex > firstMediaIndex);
          return (
            <Fragment key={slide.id}>
              {showDivider && (
                <div className="h-px w-full shrink-0 bg-[#e5e7eb]" />
              )}
              <div
                draggable={canEdit && armed === index}
                onDragStart={(event) => {
                  if (!canEdit || armed !== index) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", slide.id);
                  setFrom(index);
                }}
                onDragOver={(event) => {
                  // 매체 슬라이드끼리만 자리를 바꾼다(표지·서머리·THANK YOU 자리는 고정).
                  if (from === null || !canEdit) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  if (over !== index) setOver(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (from !== null && canEdit) onReorder(from, index);
                  resetDrag();
                }}
                onDragEnd={resetDrag}
                className={cn(
                  "relative flex min-w-0 shrink-0 gap-[10px] transition-opacity",
                  from === index && "opacity-40",
                )}
              >
                {/* 놓일 자리 표시 — 위로 옮기면 그 줄 위, 아래로 옮기면 그 줄 아래에 보라 선. */}
                {from !== null && over === index && over !== from && (
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute right-0 left-[26px] h-[3px] rounded-full bg-primary-500",
                      over < from ? "-top-[7px]" : "-bottom-[7px]",
                    )}
                  />
                )}
                {/* 번호(16px 칸) — 매체 슬라이드는 아래에 끌기 손잡이. */}
                <div className="flex w-[16px] shrink-0 flex-col items-center gap-[11px] pt-[10px]">
                  <span className="text-center text-[12px] leading-[14px] text-[#6b7280]">
                    {index + 1}
                  </span>
                  {canEdit && (
                    // ::: 손잡이 — 누른 채로 끌면 순서를 바꾼다(누르는 자리를 넓게 16×24px).
                    <span
                      aria-label={`${slide.name} 순서 바꾸기`}
                      title="끌어서 순서 바꾸기"
                      onPointerDown={() => setArmed(index)}
                      onPointerUp={() => {
                        if (from === null) setArmed(null);
                      }}
                      className="-my-[7px] flex h-[24px] w-[16px] cursor-grab items-center justify-center rounded-[4px] hover:bg-[#e5e7eb] active:cursor-grabbing"
                    >
                      <Image
                        src="/icons/proposal-detail/grip.svg"
                        alt=""
                        width={5.5}
                        height={9.375}
                        draggable={false}
                        className="pointer-events-none"
                      />
                    </span>
                  )}
                </div>

                {/* 썸네일 카드 150×95(곡률 10px) — 고르면 보라 2px 테두리. */}
                <button
                  type="button"
                  onClick={() => onSelect(slide.id)}
                  aria-label={`${index + 1}번 슬라이드 ${slide.name}`}
                  aria-current={selected || undefined}
                  className={cn(
                    "relative flex h-[95px] max-w-[150px] min-w-0 flex-1 flex-col items-center rounded-[10px] bg-white p-[4px] text-left transition-colors",
                    selected
                      ? "border-2 border-[#a33bd1] p-[3px]"
                      : "border border-[#e5e7eb] hover:border-[#d4d4d8]",
                  )}
                >
                  <span
                    className={cn(
                      "relative h-[67px] w-full shrink-0 overflow-hidden rounded-[5px]",
                      selected ? "bg-[#e2e8f0]" : "bg-[#f1f5f9]",
                    )}
                  >
                    {renderThumb(slide)}
                  </span>
                  <span
                    className={cn(
                      "mt-[5px] w-full truncate text-center text-[11px] leading-[13px] text-[#1f2937]",
                      selected ? "font-bold" : "font-medium",
                    )}
                  >
                    {slide.name}
                  </span>
                  {canEdit && (
                    // 슬라이드 빼기 — 20px 회색 칸(곡률 7px)에 흰 휴지통.
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="슬라이드 삭제"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteSlide(index + 1, slide.id, slide.name);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          onDeleteSlide(index + 1, slide.id, slide.name);
                        }
                      }}
                      className={cn(
                        "absolute flex size-[20px] items-center justify-center rounded-[7px] bg-[#6b7280] text-white transition-colors hover:bg-[#4b5563]",
                        selected
                          ? "top-[8px] right-[8px]"
                          : "top-[9px] right-[9px]",
                      )}
                    >
                      <TrashOutlineIcon className="size-[14px]" />
                    </span>
                  )}
                </button>
              </div>
            </Fragment>
          );
        })}
      </ScrollShadow>

      {!locked && (
        <div className="shrink-0 p-[10px]">
          {/* 관심 매체에서 추가하기 — 40px → 곡률 17px. */}
          <Button
            variant="ghost"
            onPress={onAddFromFavorites}
            className="h-[40px] w-full gap-[10px] rounded-[17px] border border-[#e5e7eb] bg-white px-[10px] text-[12px] font-semibold text-[#111827] shadow-[0px_2px_8px_0px_rgba(229,231,235,0.5)] data-[hovered=true]:bg-[#fafafa]"
          >
            <Image
              src="/icons/proposal-detail/add-favorites.svg"
              alt=""
              width={12}
              height={12}
            />
            관심 매체에서 추가하기
          </Button>
        </div>
      )}
    </aside>
  );
}
