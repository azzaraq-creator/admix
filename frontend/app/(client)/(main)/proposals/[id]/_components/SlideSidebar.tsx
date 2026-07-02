"use client";

import Link from "next/link";
import { Fragment, type ReactNode, useRef } from "react";

import { GripVerticalIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { Slide } from "./SlideLightbox";

export function SlideSidebar({
  slides,
  firstMediaIndex,
  locked,
  selectedId,
  onSelect,
  onReorder,
  onDeleteSlide,
  renderThumb,
}: {
  slides: Slide[];
  firstMediaIndex: number;
  locked: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDeleteSlide: (slideNumber: number, mediaId: string, name: string) => void;
  renderThumb: (slide: Slide) => ReactNode;
}) {
  const dragIndex = useRef<number | null>(null);

  return (
    <aside className="flex w-[284px] shrink-0 flex-col border-r border-[#e8e8e8]">
      <div className="flex h-[48px] items-center px-[24px]">
        <p className="text-sm font-medium leading-[20px] text-[#757575]">
          슬라이드 <span className="text-primary">{slides.length}</span>
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[24px] py-[16px]">
        {slides.map((slide, index) => {
          const lastIndex = slides.length - 1;
          const isFixed = index < firstMediaIndex || index === lastIndex;
          const canEdit = !isFixed && !locked;
          const showDivider =
            index === firstMediaIndex ||
            (index === lastIndex && lastIndex > firstMediaIndex);
          return (
            <Fragment key={slide.id}>
              {showDivider && (
                <div className="h-px w-full shrink-0 bg-[#e8e8e8]" />
              )}
              <div
                draggable={canEdit}
                onDragStart={() => {
                  if (canEdit) dragIndex.current = index;
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  const from = dragIndex.current;
                  dragIndex.current = null;
                  if (from !== null) onReorder(from, index);
                }}
                onDragEnd={() => {
                  dragIndex.current = null;
                }}
                className={cn(
                  "flex items-center border-l-2 border-transparent",
                  canEdit && "hover:border-primary",
                )}
              >
                {canEdit ? (
                  <GripVerticalIcon className="size-[16px] shrink-0 cursor-grab text-[#c9cad3] active:cursor-grabbing" />
                ) : (
                  <span className="size-[16px] shrink-0" />
                )}
                <div className="flex min-w-0 flex-1 items-start">
                  <p className="w-[20px] shrink-0 pt-[8px] text-sm font-medium leading-[20px] text-[#757575]">
                    {index + 1}
                  </p>
                  <div className="flex min-w-0 flex-1 flex-col gap-[8px] pl-[6px]">
                    <button
                      type="button"
                      onClick={() => onSelect(slide.id)}
                      className={cn(
                        "group relative aspect-[1920/1080] w-full overflow-hidden rounded-[8px]",
                        selectedId === slide.id
                          ? "ring-2 ring-inset ring-primary"
                          : "ring-1 ring-inset ring-stroke",
                      )}
                    >
                      {renderThumb(slide)}
                      {canEdit && (
                        <span
                          role="button"
                          tabIndex={0}
                          aria-label="슬라이드 삭제"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteSlide(index + 1, slide.id, slide.name);
                          }}
                          className="absolute right-[7px] top-[7px] flex items-center rounded-full bg-black/70 p-[4px] text-white"
                        >
                          <TrashIcon className="size-[14px]" />
                        </span>
                      )}
                    </button>
                    <p className="text-center text-sm font-medium leading-[20px] text-black">
                      {slide.name}
                    </p>
                  </div>
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
      {!locked && (
        <div className="border-t border-stroke px-[24px] py-[12px]">
          <Link
            href="/fixed"
            className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
          >
            <PlusIcon className="size-[24px]" />
            매체추가
          </Link>
        </div>
      )}
    </aside>
  );
}
