import { cn } from "@/lib/utils";

export type MovingMediaData = {
  id: string;
  name: string;
  price: string;
  image?: string;
  badge?: "popular" | "new";
};

const BADGE_LABEL = { popular: "인기", new: "신규" } as const;

function Badge({ badge }: { badge: "popular" | "new" }) {
  return (
    <span
      className={cn(
        "absolute left-[8px] top-[8px] inline-flex items-center justify-center rounded-full px-[10px] py-[4px] text-xs font-medium leading-[16px]",
        badge === "popular" ? "bg-secondary text-primary" : "bg-[#fff3d3] text-[#ff920a]",
      )}
    >
      {BADGE_LABEL[badge]}
    </span>
  );
}

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
        "flex flex-col gap-[12px] rounded-[12px] border border-stroke p-[12px] text-left transition-colors",
        selected ? "bg-grey-50" : "bg-white",
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-[#d9d9d9]">
        {data.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={data.image} alt="" className="size-full object-cover" />
        )}
        {data.badge && <Badge badge={data.badge} />}
      </div>
      <div className="flex flex-col gap-[2px]">
        <p className="truncate text-base font-bold leading-[24px] text-black">
          {data.name}
        </p>
        <p className="truncate text-sm font-medium leading-[20px] text-[#757575]">
          {data.price}
        </p>
      </div>
    </button>
  );
}
