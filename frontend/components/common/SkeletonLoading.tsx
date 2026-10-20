import type { ReactNode } from "react";

import { SpinningSymbol } from "@/components/common/SpinningSymbol";
import { cn } from "@/lib/utils";

/**
 * 뼈대(스켈레톤) 로딩 — 매체 찾기 목록과 같은 모습. 뼈대를 흐리게 깔고, 그 위에 엷은 흰 막과
 * 빙글빙글 도는 심볼을 가운데에 띄운다. children에 뼈대를 넣는다.
 */
export function SkeletonLoading({
  children,
  className,
  symbolClassName = "size-[40px]",
}: {
  children: ReactNode;
  className?: string;
  /** 심볼 크기 — 작은 칸(채팅 카드 등)에서는 줄여 쓴다. */
  symbolClassName?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="blur-[3px]">
        {children}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/30">
        <SpinningSymbol className={symbolClassName} />
      </div>
    </div>
  );
}
