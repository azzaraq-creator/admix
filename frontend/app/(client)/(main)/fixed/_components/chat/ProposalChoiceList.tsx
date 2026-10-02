import { Spinner } from "@heroui/react";
import { useState } from "react";

import { ChevronRightIcon, CollectionIcon } from "@/components/icons";
import type { V2ProposalRef } from "@/hooks/adRecommendReact";
import { cn } from "@/lib/utils";

/**
 * 믹시가 "어느 제안서에 담을까요?"라고 되물을 때의 제안서 고르기 목록.
 * 믹시 제안서 카드(ProposalCard)·담는 제안서 패널과 같은 흰 카드 — 제안서 아이콘(흰 칸·짙은 회색),
 * 제안서명, 매체 수, 오른쪽 화살표. 누르는 동안 그 줄에 스피너를 띄우고 다른 줄은 잠근다.
 */
export function ProposalChoiceList({
  proposals,
  onPick,
}: {
  proposals: V2ProposalRef[];
  onPick: (proposal: V2ProposalRef) => Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-[4px] rounded-[16px] border border-[#ececef] bg-white p-[6px] shadow-[0px_4px_10px_rgba(0,0,0,0.04)]">
      {proposals.map((p) => {
        const pending = pendingId === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={pendingId != null}
            onClick={async () => {
              setPendingId(p.id);
              try {
                await onPick(p);
              } finally {
                setPendingId(null);
              }
            }}
            // 줄 높이 52px 안팎 → 곡률 12px.
            className={cn(
              "flex w-full items-center gap-[12px] rounded-[12px] px-[10px] py-[9px] text-left transition-colors",
              "hover:bg-[#f7f7f8] disabled:cursor-default",
              pending && "bg-primary-50",
              pendingId != null && !pending && "opacity-50",
            )}
          >
            {/* 아이콘 칸 34px → 곡률 13px — 담는 제안서 패널의 제안서 선택 칸과 같은 모양. */}
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[13px] border border-[#ececef] bg-white text-black-700">
              <CollectionIcon className="size-[17px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-[1px]">
              <span className="truncate text-[14px] font-semibold text-[#18181b]">
                {p.name}
              </span>
              <span className="text-[12px] text-[#71717a]">
                매체 {p.media_count}개
              </span>
            </span>
            {pending ? (
              <Spinner size="sm" className="shrink-0" />
            ) : (
              <ChevronRightIcon className="size-[16px] shrink-0 text-[#a1a1aa]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
