"use client";

import { useEffect, type RefObject } from "react";

/** 키보드가 다 올라와 창 높이가 자리잡을 때까지 기다리는 시간(ms). */
const SETTLE_MS = 300;

/**
 * 모바일 — 창(스크롤 영역) 안의 입력칸을 누르면 키보드가 올라오며 HeroUI 모달이 보이는 높이
 * (visual viewport)만큼 줄어드는데, 브라우저는 줄어들기 전에만 스크롤해서 누른 칸이 가려진다.
 * 칸에 포커스가 들어올 때와 보이는 높이가 바뀔 때마다, 포커스된 칸을 스크롤 영역 안 보이는 곳으로 옮긴다.
 */
export function useKeepFocusedInView(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
      const active = document.activeElement;
      if (
        !(active instanceof HTMLElement) ||
        !container.contains(active) ||
        !active.matches("input, textarea")
      ) {
        return;
      }
      // 여러 줄 칸(내용)은 윗부분이 보이도록, 한 줄 칸은 가운데로.
      active.scrollIntoView({
        block: active instanceof HTMLTextAreaElement ? "start" : "center",
        behavior: "smooth",
      });
    };
    const revealLater = () => {
      clearTimeout(timer);
      timer = setTimeout(reveal, SETTLE_MS);
    };

    container.addEventListener("focusin", revealLater);
    window.visualViewport?.addEventListener("resize", revealLater);
    return () => {
      clearTimeout(timer);
      container.removeEventListener("focusin", revealLater);
      window.visualViewport?.removeEventListener("resize", revealLater);
    };
  }, [ref]);
}
