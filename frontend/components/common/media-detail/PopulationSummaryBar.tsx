import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    box: "p-[12px]",
    tileGap: "",
    label: "text-sm font-medium leading-[20px]",
    value: "text-base font-bold leading-[24px]",
    divider: "h-[40px]",
    audienceGap: "gap-[6px]",
    audienceItemGap: "gap-[2px]",
    audienceText: "text-base font-bold leading-[24px]",
  },
  lg: {
    box: "py-[24px]",
    tileGap: "gap-[8px]",
    label: "text-[18px] font-medium leading-[28px] tracking-[-0.04px]",
    value: "text-[24px] font-bold leading-[32px] tracking-[-0.1px]",
    divider: "h-[52px]",
    audienceGap: "gap-[12px]",
    audienceItemGap: "gap-[4px]",
    audienceText: "text-[24px] font-bold leading-[32px] tracking-[-0.1px]",
  },
} as const;

export function PopulationSummaryBar({
  monthlyTraffic,
  mainAudience,
  size = "sm",
}: {
  monthlyTraffic: string;
  mainAudience: { gender: string; age: string }[];
  size?: "sm" | "lg";
}) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-[20px] rounded-[12px] bg-grey-50",
        s.box,
      )}
    >
      <div className={cn("flex flex-1 flex-col items-center text-center", s.tileGap)}>
        <p className={cn("w-full text-grey-500", s.label)}>월평균 유동인구수</p>
        <p className={cn("w-full text-black", s.value)}>{monthlyTraffic}</p>
      </div>
      <div className={cn("w-px self-stretch bg-stroke", s.divider)} />
      <div className={cn("flex flex-1 flex-col items-center text-center", s.tileGap)}>
        <p className={cn("w-full text-grey-500", s.label)}>주요 인구층</p>
        <div
          className={cn(
            "flex w-full items-center justify-center whitespace-nowrap text-black",
            s.audienceGap,
            s.audienceText,
          )}
        >
          {mainAudience.map((a, index) => (
            <span key={index} className={cn("flex items-center", s.audienceItemGap)}>
              <span>{a.gender}</span>
              <span>{a.age}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
