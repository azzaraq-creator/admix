import { Card } from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * 어드민 구역 카드 — 테두리 없는 흰 HeroUI Card(기본, 옅은 그림자). 본문 바탕이 옅은 회색(gray-50)이라 카드가 구분된다.
 * 매장 상세에서 정한 모양을 어드민 전체로 넓혔다(2026-11-12 사용자 "카드는 흰색, 배경은 다른 색" → "다른 페이지도 동일하게").
 *
 * - 화면 제목 · 뒤로가기는 카드 밖(회색 바탕)에 두고, 내용 묶음마다 이 카드 하나.
 * - 카드 안에는 테두리 상자를 다시 넣지 않는다(사용자 "테두리가 맘에 안 들어"). 안에서 나눌 땐 Separator · 여백,
 *   값 상자가 필요하면 테두리 없는 옅은 회색 바탕(bg-gray-50)으로.
 * - title · right 가 없으면 머리 없이 내용만 그린다.
 */
export function AdminPanel({
  title,
  desc,
  right,
  children,
  className,
  contentClassName,
}: {
  title?: ReactNode;
  /** 제목 옆 짧은 설명(개수 · 안내) */
  desc?: ReactNode;
  /** 머리 오른쪽(수정 아이콘 · 버튼) */
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const hasHead = title != null || right != null;
  return (
    <Card
      variant="default"
      className={cn(
        "min-w-0 gap-[18px] rounded-[20px] p-[20px] md:p-[24px]",
        className,
      )}
    >
      {hasHead && (
        <Card.Header className="flex-row flex-wrap items-center justify-between gap-[8px]">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-[8px] gap-y-[2px]">
            {title != null && (
              <Card.Title className="text-[17px] font-bold leading-[26px] text-black">
                {title}
              </Card.Title>
            )}
            {desc != null && (
              <span className="text-sm font-medium text-disabled">{desc}</span>
            )}
          </div>
          {right != null && (
            <div className="flex shrink-0 flex-wrap items-center gap-[8px]">
              {right}
            </div>
          )}
        </Card.Header>
      )}
      <Card.Content className={cn("min-w-0 gap-[18px]", contentClassName)}>
        {children}
      </Card.Content>
    </Card>
  );
}
