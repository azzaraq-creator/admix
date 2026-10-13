"use client";

import { cn } from "@/lib/utils";

export interface PopularitySummary {
  score: number;
  rank: number | null;
  total: number;
  top_pct: number | null;
  badge: boolean;
  /** 관리자가 "인기 매체"로 지정해 뱃지가 붙었는지(저장된 값 기준) */
  forced?: boolean;
  /** 뱃지 기준 — 상위 몇 %(백엔드 BADGE_TOP_RATIO) */
  badge_top_pct?: number;
  breakdown: {
    key: string;
    label: string;
    people: number | null;
    weight: number;
    points: number;
  }[];
}

/**
 * 어드민 매체 상세 "인기 점수" — 총점·순위·뱃지와 항목별 점수(제출·기획안 담기·관심 매체).
 * 관리자 "인기 매체" 지정은 점수에 더하지 않고 뱃지만 붙인다(forced).
 * 점수 규칙은 백엔드 popularity.py.
 */
export function PopularityScore({ data }: { data?: PopularitySummary }) {
  if (!data) {
    return (
      <div className="rounded-[12px] bg-[#f5f6fb] px-[16px] py-[14px] text-[13px] text-[#727892]">
        저장하면 계산돼요.
      </div>
    );
  }
  return (
    <div className="flex items-stretch gap-[16px] rounded-[12px] bg-[#f5f6fb] p-[16px] max-sm:flex-col">
      <div className="flex w-[200px] shrink-0 flex-col justify-center gap-[8px] max-sm:w-auto">
        <p className="text-[28px] font-bold leading-none tracking-[-0.7px] text-[#161a2e] tabular-nums">
          {data.score}
          <span className="ml-[2px] text-[16px] font-semibold text-[#555b73]">
            점
          </span>
        </p>
        <p className="text-[12px] text-[#727892]">
          {data.rank != null
            ? `전체 ${data.total}개 중 ${data.rank}위 · 상위 ${data.top_pct}%`
            : "최근 90일 반응 없음"}
        </p>
        <span
          className={cn(
            "w-fit rounded-full px-[10px] py-[3px] text-[12px] font-semibold",
            data.badge
              ? "bg-primary-50 text-primary-600"
              : "bg-white text-[#9aa0b4]",
          )}
        >
          {data.forced
            ? "인기 뱃지 표시 중 · 관리자 지정"
            : data.badge
              ? "인기 뱃지 표시 중 · 점수 상위"
              : `뱃지 없음 · 상위 ${data.badge_top_pct ?? 5}%부터`}
        </span>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-3 gap-[8px] max-sm:grid-cols-1">
        {data.breakdown.map((item) => {
          const empty = item.points === 0;
          return (
            <div
              key={item.key}
              className="flex flex-col justify-center gap-[4px] rounded-[10px] bg-white px-[14px] py-[12px]"
            >
              <p className="text-[12px] font-medium text-[#727892]">
                {item.label}
              </p>
              <p
                className={cn(
                  "text-[20px] font-bold leading-tight tabular-nums",
                  empty ? "text-[#c3c7d6]" : "text-[#161a2e]",
                )}
              >
                {item.points}점
              </p>
              <p className="text-[11px] text-[#9aa0b4] tabular-nums">
                {item.people != null
                  ? `${item.people}명 × ${item.weight}점`
                  : "-"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
