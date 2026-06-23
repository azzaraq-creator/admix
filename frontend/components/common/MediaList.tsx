"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { MediaItem, type MediaItemData } from "./MediaItem";
import { SimpleViewToggle } from "./SimpleViewToggle";

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
      <SimpleViewToggle
        simple={simple}
        onChange={setSimple}
        className="w-full justify-end"
      />

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
