"use client";

import { usePathname } from "next/navigation";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useActivePageTourStep } from "@/components/common/PageTour";
import { MixieIcon } from "@/components/icons";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { cn } from "@/lib/utils";

import { useMixieChat } from "./useMixieChat";

/** 벽에 붙은 탭의 벽을 따라가는 길이(끄는 동안엔 이 크기의 네모). */
const LONG = 52;
/** 벽에서 튀어나온 깊이. */
const DEPTH = 40;
/** 모서리 — (높이/2)-3px. */
const RADIUS = LONG / 2 - 3;
/** 탭이 벽을 따라 모서리(화면 끝)에서 띄우는 거리 */
const MARGIN = 12;
/** 모바일 상단바 높이 — 그 아래로만 다닌다. */
const TOP_NAV = 48;
/** 이만큼 움직여야 끌기로 본다(그보다 적으면 누름). */
const DRAG_THRESHOLD = 6;
const STORAGE_KEY = "admix-mixie-fab";
/** 대시보드 가이드에서 이 버튼을 밝히는 단계 id(= data-tour 값). */
export const MIXIE_FAB_STEP_ID = "mixie-fab";

type Edge = "left" | "right" | "top" | "bottom";
/** 붙은 벽과, 그 벽을 따라 어디쯤인지(0~1) — 화면 크기가 바뀌어도 같은 자리 비율로 둔다. */
type Spot = { edge: Edge; ratio: number };

// 처음엔 오른쪽 맨 아래 — 가운데 아래의 "지도 보기"·"목록 보기" 버튼과 같은 줄, 본문 글자를 덜 가린다.
const DEFAULT_SPOT: Spot = { edge: "right", ratio: 1 };

/** 벽을 따라 다닐 수 있는 범위(탭 왼쪽 위 기준) — 좌우 벽은 세로로, 위아래 벽은 가로로. */
function along(w: number, h: number) {
  return {
    minX: MARGIN,
    maxX: w - LONG - MARGIN,
    minY: TOP_NAV + MARGIN,
    maxY: h - LONG - MARGIN,
  };
}

type Box = { x: number; y: number; w: number; h: number; radius: string };

/** 벽에 붙은 탭 — 벽 쪽 두 모서리는 각지고, 반대쪽만 둥글다. */
function spotToBox(spot: Spot, w: number, h: number): Box {
  const a = along(w, h);
  const at = (min: number, max: number) => min + (max - min) * spot.ratio;
  const r = `${RADIUS}px`;
  switch (spot.edge) {
    case "left":
      return {
        x: 0,
        y: at(a.minY, a.maxY),
        w: DEPTH,
        h: LONG,
        radius: `0 ${r} ${r} 0`,
      };
    case "right":
      return {
        x: w - DEPTH,
        y: at(a.minY, a.maxY),
        w: DEPTH,
        h: LONG,
        radius: `${r} 0 0 ${r}`,
      };
    case "top":
      return {
        x: at(a.minX, a.maxX),
        y: TOP_NAV,
        w: LONG,
        h: DEPTH,
        radius: `0 0 ${r} ${r}`,
      };
    case "bottom":
      return {
        x: at(a.minX, a.maxX),
        y: h - DEPTH,
        w: LONG,
        h: DEPTH,
        radius: `${r} ${r} 0 0`,
      };
  }
}

/** 놓은 자리(끄는 네모의 왼쪽 위)에서 가장 가까운 벽으로 — 가운데에는 두지 않는다. */
function nearestSpot(x: number, y: number, w: number, h: number): Spot {
  const a = along(w, h);
  const ratio = (v: number, min: number, max: number) =>
    max > min ? Math.min(Math.max((v - min) / (max - min), 0), 1) : 0;
  const candidates: [number, Spot][] = [
    [x, { edge: "left", ratio: ratio(y, a.minY, a.maxY) }],
    [w - LONG - x, { edge: "right", ratio: ratio(y, a.minY, a.maxY) }],
    [y - TOP_NAV, { edge: "top", ratio: ratio(x, a.minX, a.maxX) }],
    [h - LONG - y, { edge: "bottom", ratio: ratio(x, a.minX, a.maxX) }],
  ];
  return candidates.reduce((best, cur) => (cur[0] < best[0] ? cur : best))[1];
}

/** 벽 쪽 테두리는 뺀다(벽에 붙은 면). */
const WALL_BORDER: Record<Edge, CSSProperties> = {
  left: { borderLeftWidth: 0 },
  right: { borderRightWidth: 0 },
  top: { borderTopWidth: 0 },
  bottom: { borderBottomWidth: 0 },
};

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
 * 모바일 전용 — 화면 벽에 붙어 있는 AI 믹시 탭. 누르면 믹시 패널을 열고, 끌어서 옮기면 놓은 자리에서
 * 가장 가까운 벽(위·아래·왼쪽·오른쪽)에 붙는다(벽 쪽은 각지고 반대쪽만 둥근 반쪽 모양). 놓은 자리는 기억해 둔다.
 * 홈은 믹시 대화가 본문이라 띄우지 않고(대시보드 가이드가 이 버튼을 밝히는 동안만 띄운다),
 * 패널이 열려 있는 동안엔 숨긴다.
 */
export function MixieFloatingButton() {
  const isDesktop = useIsDesktop();
  const pathname = usePathname();
  const { panelOpen, setPanelOpen } = useMixieChat();
  const tourStep = useActivePageTourStep();

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

  if (
    isDesktop ||
    (pathname === "/" && tourStep !== MIXIE_FAB_STEP_ID) ||
    !viewport
  )
    return null;

  // 끄는 동안엔 벽에서 떨어진 둥근 네모, 놓으면 벽에 붙은 탭.
  const box: Box = dragXY
    ? { ...dragXY, w: LONG, h: LONG, radius: `${RADIUS}px` }
    : spotToBox(spot, viewport.w, viewport.h);

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    // 지난 끌기 뒤에 click이 오지 않았으면(터치) 남은 표시를 지운다.
    suppressClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: box.x,
      originY: box.y,
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
    setDragXY({
      x: Math.min(Math.max(drag.originX + dx, 0), viewport.w - LONG),
      y: Math.min(Math.max(drag.originY + dy, TOP_NAV), viewport.h - LONG),
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
      data-tour={MIXIE_FAB_STEP_ID}
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
        // 본문을 가리지 않게 눈에 덜 띄도록 — 지도 위 스위치 묶음과 같은 반투명 유리(뒤 화면이 흐리게 비친다).
        "fixed top-0 left-0 z-40 flex touch-none items-center justify-center border-[0.5px] border-white/40 bg-white/40 shadow-[0px_4px_16px_rgba(0,0,0,0.14)] backdrop-blur-[6px] backdrop-saturate-[1.8] select-none sm:hidden",
        // 놓으면 벽으로 미끄러져 붙는다. 끄는 동안엔 손가락을 바로 따라간다.
        !dragXY &&
          "transition-[translate,width,height,border-radius,opacity] duration-200 ease-out motion-reduce:transition-none",
        panelOpen && "pointer-events-none opacity-0",
      )}
      style={{
        width: box.w,
        height: box.h,
        borderRadius: box.radius,
        translate: `${box.x}px ${box.y}px`,
        ...(dragXY ? null : WALL_BORDER[spot.edge]),
      }}
    >
      <MixieIcon aria-hidden className="size-[20px]" />
    </button>
  );
}
