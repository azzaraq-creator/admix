import { MaximizeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: {
    box: "gap-[16px] px-[16px] py-[12px]",
    icon: "size-[24px]",
    inner: "gap-[2px]",
    label: "text-sm font-medium leading-[20px]",
    value: "text-base font-medium leading-[20px]",
  },
  lg: {
    box: "gap-[15px] p-[40px]",
    icon: "size-[58px]",
    inner: "gap-[6px]",
    label: "text-[18px] font-medium leading-[28px] tracking-[-0.04px]",
    value: "text-[20px] font-bold leading-[28px] tracking-[-0.08px]",
  },
} as const;

export function SizeSection({
  sizeText,
  size = "sm",
}: {
  sizeText: string;
  size?: "sm" | "lg";
}) {
  const s = SIZE[size];
  return (
    <div
      className={cn(
        "flex items-center rounded-[8px] border border-stroke",
        s.box,
      )}
    >
      <MaximizeIcon className={cn("shrink-0 text-black", s.icon)} />
      <div className={cn("flex flex-col", s.inner)}>
        <p className={cn("text-grey-500", s.label)}>사이즈 및 규격</p>
        <p className={cn("text-black", s.value)}>{sizeText}</p>
      </div>
    </div>
  );
}
