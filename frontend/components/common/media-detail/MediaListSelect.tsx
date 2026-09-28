import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    pad: "p-[16px]",
    gap: "gap-[12px]",
    textGap: "gap-[2px]",
    title: "text-base font-semibold leading-[24px]",
    subtitle: "text-sm font-medium leading-[20px]",
  },
  lg: {
    pad: "p-[20px]",
    gap: "gap-[16px]",
    textGap: "gap-[4px]",
    title: "text-[20px] font-semibold leading-[28px] tracking-[-0.08px]",
    subtitle: "text-base font-medium leading-[24px]",
  },
} as const;

export type MediaListSelectItem = { title: string; subtitle: string };

export function MediaListSelect({
  items,
  value,
  onChange,
  size = "sm",
  layout = "list",
}: {
  items: MediaListSelectItem[];
  value: number;
  onChange: (index: number) => void;
  size?: "sm" | "lg";
  layout?: "list" | "grid";
}) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        layout === "grid"
          ? // min(332px,100%) — 컨테이너가 332px보다 좁으면(모바일·팝업) 가로로 넘치지 않고 1열이 된다.
            "grid gap-[10px] [grid-template-columns:repeat(auto-fill,minmax(min(332px,100%),1fr))]"
          : "flex flex-col gap-[8px]",
      )}
    >
      {items.map((item, index) => {
        const selected = value === index;
        return (
          <button
            key={index}
            type="button"
            onClick={() => onChange(index)}
            className={cn(
              "flex items-center rounded-[8px] text-left",
              s.pad,
              s.gap,
              selected
                ? "border-2 border-primary bg-secondary"
                : "border border-stroke",
            )}
          >
            <div className={cn("flex min-w-0 flex-1 flex-col", s.textGap)}>
              <p className={cn("text-black", s.title)}>{item.title}</p>
              {item.subtitle && (
                <p className={cn("text-grey-500", s.subtitle)}>
                  {item.subtitle}
                </p>
              )}
            </div>
            <span
              className={cn(
                "flex size-[24px] shrink-0 items-center justify-center rounded-full border-2",
                selected ? "border-primary" : "border-[#d3d4d6]",
              )}
            >
              {selected && (
                <span className="size-[12px] rounded-full bg-primary" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
