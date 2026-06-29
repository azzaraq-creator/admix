"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface DeckSlide {
  image: string;
  thumb: string;
}

interface PptDeckViewerProps {
  deckId: string;
  slides: DeckSlide[];
  title?: string;
}

export default function PptDeckViewer({ deckId, slides, title }: PptDeckViewerProps) {
  const [current, setCurrent] = useState(0);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const total = slides.length;
  const basePath = `/decks/${deckId}`;

  const goTo = useCallback(
    (idx: number) => {
      setCurrent(Math.min(Math.max(0, idx), total - 1));
    },
    [total],
  );
  const goPrev = useCallback(() => goTo(current - 1), [current, goTo]);
  const goNext = useCallback(() => goTo(current + 1), [current, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          goPrev();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          e.preventDefault();
          goNext();
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(total - 1);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goPrev, goNext, goTo, total]);

  useEffect(() => {
    thumbRefs.current[current]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current]);

  if (total === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-400">
        슬라이드가 없습니다.
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-zinc-900 text-zinc-100">
      <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        {title && (
          <div className="border-b border-zinc-800 px-4 py-3 text-sm font-medium text-zinc-300">
            {title}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-2">
          {slides.map((slide, i) => (
            <button
              key={i}
              ref={(el) => {
                thumbRefs.current[i] = el;
              }}
              onClick={() => goTo(i)}
              className={cn(
                "mb-2 flex w-full flex-col items-stretch gap-1 rounded p-1 text-left transition-colors",
                current === i
                  ? "bg-blue-500/20 ring-2 ring-blue-500"
                  : "ring-2 ring-transparent hover:bg-zinc-800",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${basePath}/${slide.thumb}`}
                alt={`Slide ${i + 1} thumbnail`}
                className="w-full rounded-sm bg-white shadow"
                loading="lazy"
              />
              <span className="text-xs text-zinc-400">{i + 1}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${basePath}/${slides[current].image}`}
            alt={`Slide ${current + 1}`}
            className="max-h-full max-w-full rounded shadow-2xl"
          />
        </div>

        <div className="flex items-center justify-center gap-4 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="rounded px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-30"
          >
            ◀ 이전
          </button>
          <span className="min-w-[80px] text-center text-sm tabular-nums">
            {current + 1} / {total}
          </span>
          <button
            onClick={goNext}
            disabled={current === total - 1}
            className="rounded px-3 py-1 text-sm hover:bg-zinc-800 disabled:opacity-30"
          >
            다음 ▶
          </button>
        </div>
      </main>
    </div>
  );
}
