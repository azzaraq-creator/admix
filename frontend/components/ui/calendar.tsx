"use client";

import type { CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

// 선택/오늘 색을 서비스 primary(#00aaa4)로. 기본 스타일시트는 app/layout.tsx 에서 import.
const ACCENT_VARS = {
  "--rdp-accent-color": "#00aaa4",
  "--rdp-accent-background-color": "#e5f6f6",
  "--rdp-today-color": "#00aaa4",
} as CSSProperties;

export function Calendar({ className, style, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays
      // 변수는 root(.rdp-root)에 인라인으로 넣어야 style.css 기본값(blue)을 덮는다.
      style={{ ...ACCENT_VARS, ...style }}
      className={cn("p-[12px] text-[14px]", className)}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-[16px]" />
          ) : (
            <ChevronRight className="size-[16px]" />
          ),
      }}
      {...props}
    />
  );
}
