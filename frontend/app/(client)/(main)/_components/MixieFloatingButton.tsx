"use client";

import { usePathname } from "next/navigation";
import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { MixieIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import { useMixieChat } from "./useMixieChat";

const SIZE = 52;
/** 벽에서 띄우는 거리 */
const MARGIN = 12;
/** 모바일 상단바 높이 — 그 아래로만 다닌다. */
const TOP_NAV = 48;
/** 이만큼 움직여야 끌기로 본다(그보다 적으면 누름). */
const DRAG_THRESHOLD = 6;
const STORAGE_KEY = "admix-mixie-fab";

type Edge = "left" | "right" | "top" | "bottom";
/** 붙은 벽과, 그 벽을 따라 어디쯤인지(0~1) — 화면 크기가 바뀌어도 같은 자리 비율로 둔다. */
type Spot = { edge: Edge; ratio: number };

// 처음엔 오른쪽 맨 아래 — 가운데 아래의 "지도 보기"·"목록 보기" 버튼과 같은 줄, 본문 글자를 덜 가린다.
const DEFAULT_SPOT: Spot = { edge: "right", ratio: 1 };

/** 다닐 수 있는 범위(버튼 왼쪽 위 기준). */
function area(w: number, h: number) {
  return {
    minX: MARGIN,
    maxX: w - SIZE - MARGIN,
    minY: TOP_NAV + MARGIN,
    maxY: h - SIZE - MARGIN,
  };
}

function spotToXY(spot: Spot, w: number, h: number) {
  const a = area(w, h);
  const along = (min: number, max: number) => min + (max - min) * spot.ratio;
  switch (spot.edge) {
    case "left":
      return { x: a.minX, y: along(a.minY, a.maxY) };
    case "right":
      return { x: a.maxX, y: along(a.minY, a.maxY) };
    case "top":
      return { x: along(a.minX, a.maxX), y: a.minY };
    case "bottom":
      return { x: along(a.minX, a.maxX), y: a.maxY };
  }
}

/** 놓은 자리에서 가장 가까운 벽으로 — 가운데에는 두지 않는다. */
function nearestSpot(x: number, y: number, w: number, h: number): Spot {
  const a = area(w, h);
  const cx = Math.min(Math.max(x, a.minX), a.maxX);
  const cy = Math.min(Math.max(y, a.minY), a.maxY);
  const ratio = (v: number, min: number, max: number) =>
    max > min ? (v - min) / (max - min) : 0;
  const candidates: [number, Spot][] = [
    [cx - a.minX, { edge: "left", ratio: ratio(cy, a.minY, a.maxY) }],
    [a.maxX - cx, { edge: "right", ratio: ratio(cy, a.minY, a.maxY) }],
    [cy - a.minY, { edge: "top", ratio: ratio(cx, a.minX, a.maxX) }],
    [a.maxY - cy, { edge: "bottom", ratio: ratio(cx, a.minX, a.maxX) }],
  ];
  return candidates.reduce((best, cur) => (cur[0] < best[0] ? cur : best))[1];
}

/** 화면 크기 — "폭x높이" 글자로 돌려줘 크기가 같으면 다시 그리지 않는다. 서버에선 null(첫 화면엔 그리지 않는다). */
function useViewport() {
  const size = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("resize", onChange);
      return () => window.removeEventListener("resize", onChange);
    },
    () => `${window.innerWidth}x${window.innerHeight}`,
    () => null,
  );
  if (!size) return null;
  const [w, h] = size.split("x").map(Number);
  return { w, h };
}

function loadSpot(): Spot {
  if (typeof window === "undefined") return DEFAULT_SPOT;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (
      saved &&
      ["left", "right", "top", "bottom"].includes(saved.edge) &&
      typeof saved.ratio === "number"
    )
      return { edge: saved.edge, ratio: Math.min(Math.max(saved.ratio, 0), 1) };
  } catch {}
  return DEFAULT_SPOT;
}

/**
 * 모바일 전용 — 화면에 떠 있는 AI 믹시 버튼. 누르면 믹시 패널을 열고, 끌어서 옮기면 놓은 자리에서
 * 가장 가까운 벽(위·아래·왼쪽·오른쪽)에 붙는다. 놓은 자리는 기억해 둔다.
 * 홈은 믹시 대화가 본문이라 띄우지 않고, 패널이 열려 있는 동안엔 숨긴다.
 */
export function MixieFloatingButton() {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const { panelOpen, setPanelOpen } = useMixieChat();

  const viewport = useViewport();
  const [spot, setSpot] = useState<Spot>(loadSpot);
  /** 끄는 중의 위치 — 끄는 동안엔 손가락을 그대로 따라간다. */
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  /** 끌기로 끝난 누름은 패널을 열지 않는다. */
  const suppressClickRef = useRef(false);

  if (isDesktop || pathname === "/" || !viewport) return null;

  const { x, y } = dragXY ?? spotToXY(spot, viewport.w, viewport.h);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // 지난 끌기 뒤에 click이 오지 않았으면(터치) 남은 표시를 지운다.
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: x,
      originY: y,
      moved: false,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    const a = area(viewport.w, viewport.h);
    setDragXY({
      x: Math.min(Math.max(drag.originX + dx, a.minX), a.maxX),
      y: Math.min(Math.max(drag.originY + dy, a.minY), a.maxY),
    });
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (!drag.moved || !dragXY) return;
    suppressClickRef.current = true;
    const next = nearestSpot(dragXY.x, dragXY.y, viewport.w, viewport.h);
    setSpot(next);
    setDragXY(null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <button
      type="button"
      aria-label="AI 믹시"
      data-mixie-toggle
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        setPanelOpen(true);
      }}
      // z-40: 본문(매체 찾기 검색바 z-30)보다 위, 믹시 패널(z-50)·팝업·가이드보다 아래.
      // touch-none: 끄는 동안 화면이 같이 스크롤되지 않게.
      className={cn(
        "fixed top-0 left-0 z-40 flex touch-none items-center justify-center rounded-full border border-gray-200 bg-white shadow-[0px_4px_16px_rgba(0,0,0,0.16)] select-none sm:hidden",
        // 놓으면 벽으로 미끄러져 붙는다. 끄는 동안엔 손가락을 바로 따라간다.
        !dragXY &&
          "transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none",
        panelOpen && "pointer-events-none opacity-0",
      )}
      style={{ width: SIZE, height: SIZE, translate: `${x}px ${y}px` }}
    >
      <MixieIcon aria-hidden className="size-[24px]" />
    </button>
  );
}
