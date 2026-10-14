import { ArrowUpIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type AgeRatio = {
  label: string;
  value: number;
  bound?: "under" | "over";
};

/**
 * 연령대별 순위(1부터) — 비율이 같으면 같은 순위. 1~3위만 표시하고, 0%는 순위를 매기지 않는다(null).
 */
export function ageRanks(data: { value: number }[]): (number | null)[] {
  return data.map((d) => {
    if (!(d.value > 0)) return null;
    const rank = 1 + data.filter((o) => o.value > d.value).length;
    return rank <= 3 ? rank : null;
  });
}

/** 막대 안에 순위를 넣을 수 있는 최소 막대 높이(px) — 이보다 짧으면 막대 위에 따로 띄운다. */
export const RANK_IN_BAR_MIN_HEIGHT = 20;

/** 막대 안 맨 위에 넣는 "1위·2위·3위" — 1위 막대는 진한 보라라 흰 글씨, 2·3위는 연한 보라 막대(3위가 더 연하게)라 보라 글씨. */
export function AgeRankInBar({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "pt-[4px] text-[10px] leading-[14px] font-bold whitespace-nowrap",
        rank === 1 ? "text-white" : "text-primary-500",
      )}
    >
      {rank}위
    </span>
  );
}

/** 막대가 짧아 안에 못 넣을 때 막대 위에 띄우는 "1위·2위·3위" — 1위는 진하게, 2·3위는 연하게. */
export function AgeRankBadge({
  rank,
  className,
}: {
  rank: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-[6px] py-[1px] text-[10px] leading-[14px] font-semibold whitespace-nowrap",
        rank === 1
          ? "bg-primary-500 text-white"
          : "bg-primary-50 text-primary-500",
        className,
      )}
    >
      {rank}위
    </span>
  );
}

type AgeBarChartProps = {
  data: AgeRatio[];
  maxBarHeight?: number;
  className?: string;
};

export function AgeBarChart({
  data,
  maxBarHeight = 200,
  className,
}: AgeBarChartProps) {
  const max = Math.max(...data.map((d) => d.value));
  const ranks = ageRanks(data);

  return (
    <div
      className={cn("flex items-end justify-between gap-[6px]", className)}
      style={{ height: maxBarHeight + 64 }}
    >
      {data.map((age, i) => {
        const rank = ranks[i];
        const primary = rank === 1;
        const height = Math.round((age.value / max) * maxBarHeight);
        return (
          <div
            key={age.label}
            className="flex h-full flex-1 flex-col items-center justify-end gap-[8px]"
          >
            {rank != null && height < RANK_IN_BAR_MIN_HEIGHT && (
              <AgeRankBadge rank={rank} />
            )}
            <div className="flex items-center">
              <span
                className={`text-sm font-semibold leading-[20px] ${primary ? "text-primary" : "text-black"}`}
              >
                {age.value}
              </span>
              <span
                className={`text-xs font-medium leading-[16px] ${primary ? "text-primary" : "text-black"}`}
              >
                %
              </span>
            </div>
            <div
              className={cn(
                "flex w-[22px] justify-center rounded-t-full",
                primary
                  ? "bg-primary"
                  : rank === 2
                    ? "bg-primary-200"
                    : rank === 3
                      ? "bg-primary-100"
                      : "bg-secondary",
              )}
              style={{ height }}
            >
              {rank != null && height >= RANK_IN_BAR_MIN_HEIGHT && (
                <AgeRankInBar rank={rank} />
              )}
            </div>
            <span className="flex items-center justify-center text-sm font-semibold leading-[20px] text-gray-500">
              {age.label}
              {age.bound === "under" && (
                <ArrowUpIcon className="size-[16px] -scale-y-100" />
              )}
              {age.bound === "over" && <ArrowUpIcon className="size-[16px]" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}
