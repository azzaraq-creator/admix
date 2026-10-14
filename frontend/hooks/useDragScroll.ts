"use client";

import { type PointerEvent, useRef } from "react";

// 이만큼(px) 넘게 움직여야 끌기로 본다 — 그보다 작으면 그냥 누른 것(선택)으로 둔다.
const DRAG_THRESHOLD = 4;

/**
 * 가로로 넘치는 목록을 마우스로 잡고 끌어 넘긴다(PC). 터치·펜은 브라우저 기본 스크롤 그대로 둔다.
 *
 * 쓰는 법: 스크롤되는 상자에 `onPointerDownCapture` 로 달고(안의 버튼이 전파를 막아도 받도록), 끌기가 끝난 직후 생기는 선택은 `wasDragged()` 로 무시한다
 * (손을 뗀 자리의 항목이 선택되지 않게).
 */
export function useDragScroll() {
  const dragged = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = e.currentTarget;
    if (el.scrollWidth <= el.clientWidth) return;
    const startX = e.clientX;
    const startLeft = el.scrollLeft;
    let moving = false;
    dragged.current = false;

    const move = (ev: globalThis.PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!moving && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!moving) {
        moving = true;
        dragged.current = true;
        el.style.cursor = "grabbing";
        el.style.userSelect = "none";
      }
      el.scrollLeft = startLeft - dx;
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.style.cursor = "";
      el.style.userSelect = "";
      // 손을 뗀 뒤 이어지는 선택(press)까지 끌기로 본 다음 풀어 준다.
      if (moving) setTimeout(() => (dragged.current = false), 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return { onPointerDown, wasDragged: () => dragged.current };
}
