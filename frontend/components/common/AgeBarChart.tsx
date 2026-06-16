import { cn } from "@/lib/utils";

export type AgeRatio = {
  label: string;
  value: number;
  bound?: "under" | "over";
};

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

  return (
    <div
      className={cn("flex items-end justify-between gap-[6px]", className)}
      style={{ height: maxBarHeight + 64 }}
    >
      {data.map((age) => {
        const primary = age.value === max;
        return (
          <div
            key={age.label}
            className="flex h-full flex-1 flex-col items-center justify-end gap-[8px]"
          >
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
              className={`w-[22px] rounded-t-full ${primary ? "bg-primary" : "bg-secondary"}`}
              style={{ height: Math.round((age.value / max) * maxBarHeight) }}
            />
            <span className="text-sm font-semibold leading-[20px] text-[#757575]">
              {age.bound === "under"
                ? `~${age.label}`
                : age.bound === "over"
                  ? `${age.label}~`
                  : age.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
