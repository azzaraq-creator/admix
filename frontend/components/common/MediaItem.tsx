import { FolderPlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type MediaItemData = {
  id: string;
  name: string;
  price: string;
  images?: string[];
  popular?: boolean;
};

type MediaItemProps = MediaItemData & {
  rank?: number;
  simple?: boolean;
  onClick?: () => void;
  onAddProposal?: () => void;
  className?: string;
};

function PopularChip({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-secondary px-[10px] py-[4px] text-xs font-medium leading-[16px] text-primary",
        className,
      )}
    >
      인기
    </span>
  );
}

export function MediaItem({
  name,
  price,
  images = [],
  popular = false,
  rank,
  simple = false,
  onClick,
  onAddProposal,
  className,
}: MediaItemProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-[12px] rounded-[8px] border border-stroke bg-white px-[16px] py-[24px]",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {rank !== undefined && (
        <span className="inline-flex h-[24px] min-w-[24px] shrink-0 items-center justify-center rounded-full bg-primary px-[4px] text-xs font-bold leading-none text-white">
          {rank}
        </span>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-[12px]">
        {!simple && (
          <div className="relative flex w-full items-start gap-[8px]">
            {[0, 1, 2].map((index) => (
              <div
                key={index}
                className="relative aspect-square min-w-0 flex-1 overflow-hidden rounded-[4px] bg-[#d9d9d9]"
              >
                {images[index] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={images[index]}
                    alt=""
                    className="size-full object-cover"
                  />
                )}
              </div>
            ))}
            {popular && <PopularChip className="absolute left-[8px] top-[8px]" />}
          </div>
        )}

        <div className="flex items-start justify-between gap-[24px]">
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-[4px]">
            {simple && popular && <PopularChip className="self-start" />}
            <div className="flex flex-col">
              <p className="truncate text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-black">
                {name}
              </p>
              <p className="truncate text-sm font-medium leading-[20px] text-[#757575]">
                {price}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAddProposal?.();
            }}
            aria-label="제안서 담기"
            className="flex shrink-0 items-center justify-center rounded-full border border-[#d3d4d6] p-[8px] text-black transition-colors hover:bg-[#f1f5f9]"
          >
            <FolderPlusIcon className="size-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
