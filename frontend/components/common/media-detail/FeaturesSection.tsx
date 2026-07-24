import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    box: "px-[16px] py-[12px]",
    list: "",
    item: "flex flex-col gap-[2px] border-b border-stroke py-[12px] last:border-b-0",
    label: "text-sm font-medium leading-[20px]",
    value: "text-base font-medium leading-[20px]",
  },
  lg: {
    box: "p-[40px]",
    list: "flex flex-wrap gap-[24px]",
    item: "flex min-w-[296px] flex-1 flex-col gap-[6px] border-b border-stroke py-[6px] pr-[16px]",
    label: "text-[18px] font-medium leading-[28px] tracking-[-0.04px]",
    value: "text-[20px] font-bold leading-[28px] tracking-[-0.08px]",
  },
} as const;

export function FeaturesSection({
  features,
  size = "sm",
}: {
  features: [string, string][];
  size?: "sm" | "lg";
}) {
  const s = SIZE[size];
  const items = features.map(([label, value]) => (
    <div key={label} className={s.item}>
      <p className={cn("text-grey-500", s.label)}>{label}</p>
      <p className={cn("text-black", s.value)}>{value}</p>
    </div>
  ));
  return (
    <div className={cn("rounded-[8px] border border-stroke", s.box)}>
      {s.list ? <div className={s.list}>{items}</div> : items}
    </div>
  );
}
