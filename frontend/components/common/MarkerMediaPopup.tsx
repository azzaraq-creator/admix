"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

import { MediaItem, type MediaItemData } from "./MediaItem";
import { SimpleViewToggle } from "./SimpleViewToggle";

type MarkerMediaPopupProps = {
  items: MediaItemData[];
  onSelect?: (item: MediaItemData) => void;
  onAddProposal?: (item: MediaItemData) => void;
  className?: string;
};

export function MarkerMediaPopup({
  items,
  onSelect,
  onAddProposal,
  className,
}: MarkerMediaPopupProps) {
  const [simple, setSimple] = useState(false);

  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "flex w-[340px] flex-col gap-[12px] rounded-[12px] border-b border-[#e8e8e8] bg-[#f6f6f6] px-[16px] py-[24px] drop-shadow-[0px_0px_6px_rgba(0,0,0,0.32)] sm:w-[383px]",
        className,
      )}
    >
      <SimpleViewToggle
        simple={simple}
        onChange={setSimple}
        className="justify-end"
      />

      <div className="flex max-h-[360px] flex-col gap-[12px] overflow-y-auto">
        {items.map((item) => (
          <MediaItem
            key={item.id}
            {...item}
            simple={simple}
            onClick={onSelect ? () => onSelect(item) : undefined}
            onAddProposal={
              onAddProposal ? () => onAddProposal(item) : undefined
            }
            className="rounded-none border-0 bg-transparent p-0"
          />
        ))}
      </div>
    </div>
  );
}
