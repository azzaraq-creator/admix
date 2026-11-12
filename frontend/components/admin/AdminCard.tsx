import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 어드민 화면 본문 틀 — 예전엔 흰 판(테두리 · 그림자 · 안쪽 여백 48px)이었는데, 2026-11-12 사용자 요청으로
 * admix 사용자 화면처럼 판 없이 화면 폭을 넓게 쓴다. 바탕 · 바깥 여백은 어드민 레이아웃(main)이 정한다.
 * 화면마다 감싼 자리는 그대로 두려고 이름은 남겼다.
 */
export function AdminCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("block min-w-0", className)}>{children}</div>;
}
