import { ChevronDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    text: "text-sm leading-[20px]",
    gap: "gap-[2px]",
    icon: "size-[18px]",
  },
  lg: {
    text: "text-[18px] leading-[28px] tracking-[-0.04px]",
    gap: "gap-[4px]",
    icon: "size-[20px]",
  },
} as const;

export function DescriptionToggle({
  expanded,
  onToggle,
  size = "sm",
  label = "매체 설명",
}: {
  expanded: boolean;
  onToggle: () => void;
  size?: "sm" | "lg";
  label?: string;
}) {
  const s = SIZE[size];
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-center gap-[8px]"
    >
      <span className="h-px flex-1 bg-grey-50" />
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-grey-50 px-[16px] py-[6px] whitespace-nowrap text-black",
          s.text,
          s.gap,
        )}
      >
        {label} {expanded ? "접기" : "더보기"}
        <ChevronDownIcon
          className={cn(
            "transition-transform",
            s.icon,
            expanded && "rotate-180",
          )}
        />
      </span>
      <span className="h-px flex-1 bg-grey-50" />
    </button>
  );
}
