import { Chip, EmptyState } from "@heroui/react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** "2026.09.30 16:56" — seconds면 "2026.09.30 16:56:07"(문의 상세의 접수·답변 일시). */
export function formatDateTime(
  iso: string | null,
  { seconds = false }: { seconds?: boolean } = {},
): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  const time = `${p(d.getHours())}:${p(d.getMinutes())}${seconds ? `:${p(d.getSeconds())}` : ""}`;
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${time}`;
}

/** 답변 상태 — 기획안 상태 배지와 같은 점 + 글자 모양. 높이 22px → 곡률 8px. */
export function InquiryStatusChip({ status }: { status: string }) {
  const answered = status === "answered";
  return (
    <Chip
      className={cn(
        "h-[22px] gap-[5px] rounded-[8px] py-0 pr-[10px] pl-[8px] text-[11px] font-medium whitespace-nowrap",
        answered
          ? "bg-[#d1fae5] text-[#069464]"
          : "bg-[#fef3c7] text-[#a17600]",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-[5px] shrink-0 rounded-full",
          answered ? "bg-[#069464]" : "bg-[#a17600]",
        )}
      />
      {answered ? "답변 완료" : "답변 대기"}
    </Chip>
  );
}

/** 비었을 때 — 기획안 목록의 빈 상태와 같은 모양(HeroUI EmptyState), 아이콘 칸만 회색. 탭 아래 남는 높이를 꽉 채운다(flex-1). */
export function ContactEmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <EmptyState className="flex flex-1 flex-col items-center justify-center gap-[8px] rounded-[20px] border border-[#ececef] bg-white px-[24px] py-[56px] text-center">
      {/* 아이콘 칸 56px → 곡률 25px. */}
      <span className="mb-[4px] flex size-[56px] items-center justify-center rounded-[25px] bg-[#f4f4f5] text-[#52525b]">
        {icon}
      </span>
      <p className="text-[16px] font-semibold text-black-900">{title}</p>
      {description && (
        <p className="text-[13px] leading-[1.6] text-[#8c8c94]">
          {description}
        </p>
      )}
      {children}
    </EmptyState>
  );
}
