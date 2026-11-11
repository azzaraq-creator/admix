"use client";

import { Card } from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** 어드민 화면 흰 판(HeroUI Card) — 테두리 · 옅은 그림자, 안쪽 여백은 PC 48px · 모바일 20px. */
export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "block rounded-[16px] border border-stroke p-[20px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.04)] md:p-[48px]",
        className,
      )}
    >
      {children}
    </Card>
  );
}
