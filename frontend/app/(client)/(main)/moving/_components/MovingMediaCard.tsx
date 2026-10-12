import { MediaThumbnail } from "@/components/common/MediaThumbnail";
import { cn } from "@/lib/utils";
import { MediaBadgeChip } from "@/components/common/MediaBadgeChip";

export type MovingMediaData = {
  id: string;
  name: string;
  price: string;
  image?: string;
  badge?: "popular" | "new";
};

export function MovingMediaCard({
  data,
  selected,
  onClick,
}: {
  data: MovingMediaData;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col gap-[12px] px-6 py-3 text-left transition-colors sm:min-w-[228px]",
        selected ? "bg-gray-50" : "bg-white",
      )}
    >
      <MediaThumbnail
        src={data.image}
        className="aspect-square w-full rounded-[8px] sm:aspect-auto sm:h-[196px]"
      >
        {data.badge && (
          <MediaBadgeChip
            badge={data.badge}
            size="md"
            className="absolute left-[8px] top-[8px]"
          />
        )}
      </MediaThumbnail>
      <div className="flex flex-col gap-[2px]">
        <p className="truncate text-[16px] font-bold leading-[24px] text-black sm:text-[20px] sm:leading-[28px] sm:tracking-[-0.08px]">
          {data.name}
        </p>
        <p className="truncate text-sm font-medium leading-[20px] text-gray-500">
          {data.price}
        </p>
      </div>
    </button>
  );
}
