import { FolderIcon } from "@/components/icons";

export function ProposalCard({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex items-center gap-[10px] rounded-[8px] bg-platinum-50 px-[16px] py-[16px]">
      <FolderIcon className="size-[20px] shrink-0 text-grey-500" />
      <span className="flex-1 truncate text-base font-medium leading-[24px] text-black">
        {name}
      </span>
      <span className="text-base font-medium leading-[24px] tabular-nums text-grey-500">
        {count}
      </span>
    </div>
  );
}
