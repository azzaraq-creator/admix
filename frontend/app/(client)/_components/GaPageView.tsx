"use client";

import { sendGAEvent } from "@next/third-parties/google";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * SPA 클라이언트 라우트 이동마다 GA4 page_view 를 명시 전송한다.
 * 최초 하드로드는 GoogleAnalytics(config)가 이미 page_view 를 보내므로 스킵 —
 * GA4 향상된 측정의 "페이지 변경(브라우저 기록 이벤트)"은 꺼두어야 중복 집계가 안 된다.
 */
export function GaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isInitial = useRef(true);

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;
    sendGAEvent("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname, searchParams]);

  return null;
}
