"use client";

import { StatusChip } from "@/components/proposals/StatusChip";

import { type Proposal } from "./proposalTypes";

function Icon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.svg`} alt="" className={className} />;
}

export function ProposalCard({
  proposal,
  onOpen,
  onDelete,
  onDownload,
  downloading,
}: {
  proposal: Proposal;
  onOpen: () => void;
  onDelete: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  return (
    <div
      onClick={onOpen}
      className="flex cursor-pointer flex-col overflow-hidden rounded-[12px] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.16)]"
    >
      <div className="relative aspect-[1920/1080] w-full overflow-hidden bg-[#2f3442]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/proposals/sample.png"
          alt=""
          className="size-full object-cover"
        />
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          aria-label="제안서 삭제"
          className="absolute right-[16px] top-[16px] flex items-center rounded-full bg-black/70 p-[4px]"
        >
          <Icon name="trash-white" className="size-[14px]" />
        </button>
      </div>
      <div className="flex flex-col gap-[16px] bg-white p-[16px]">
        <div className="flex h-[54px] flex-col gap-[6px]">
          <p className="truncate text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-black">
            {proposal.title}
          </p>
          <p className="text-sm font-medium leading-[20px] text-[#757575]">
            최종 수정 {proposal.updatedAt}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <StatusChip status={proposal.rawStatus} />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDownload();
            }}
            disabled={downloading}
            aria-label="제안서 다운로드"
            className="flex cursor-pointer items-center rounded-[6px] bg-[#f8fafc] p-[5px] disabled:cursor-default disabled:opacity-40"
          >
            <Icon name="download-primary" className="size-[21px]" />
          </button>
        </div>
      </div>
    </div>
  );
}
