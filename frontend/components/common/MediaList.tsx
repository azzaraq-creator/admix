"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import { MediaItem, type MediaItemData } from "./MediaItem";

type MediaListProps = {
  items: MediaItemData[];
  defaultSimple?: boolean;
  onAddProposal?: (id: string) => void;
  className?: string;
};

export function MediaList({
  items,
  defaultSimple = false,
  onAddProposal,
  className,
}: MediaListProps) {
  const [simple, setSimple] = useState(defaultSimple);

  return (
    <div className={cn("flex w-full flex-col gap-[8px]", className)}>
      <div className="flex w-full items-center justify-end gap-[6px]">
        <span className="text-sm font-medium leading-[20px] text-[#757575]">
          간략히보기
        </span>
        <Switch checked={simple} onCheckedChange={setSimple} />
      </div>

      <div className="flex w-full flex-col gap-[8px]">
        {items.map((item, index) => (
          <MediaItem
            key={item.id}
            {...item}
            rank={index + 1}
            simple={simple}
            onAddProposal={
              onAddProposal ? () => onAddProposal(item.id) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
