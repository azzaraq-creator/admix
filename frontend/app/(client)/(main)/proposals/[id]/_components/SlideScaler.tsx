"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";

// 1920px 기준으로 디자인된 고정 크기 슬라이드를 컨테이너 너비에 맞춰 transform scale 한다.
export function SlideScaler({
  baseWidth = 1920,
  className,
  contentClassName,
  style,
  children,
}: {
  baseWidth?: number;
  className?: string;
  contentClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      setWidth(entries[0].contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const scale = width / baseWidth;

  return (
    <div ref={ref} style={style} className={cn("overflow-hidden", className)}>
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        className={cn("absolute left-0 top-0", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
