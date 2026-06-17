import { ChevronDownIcon } from "@/components/icons";

export function YearSelect() {
  return (
    <button
      type="button"
      className="flex h-[40px] items-center gap-[6px] rounded-[8px] border border-stroke px-[12px] text-sm font-medium leading-[20px] text-[#364153]"
    >
      2026
      <ChevronDownIcon className="size-[18px] text-[#737586]" />
    </button>
  );
}
