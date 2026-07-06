"use client";

import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { XIcon } from "@/components/icons";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

export function NewProposalModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const trimmed = name.trim();

  const handleCreate = () => {
    if (!trimmed) return;
    onCreate(trimmed);
    setName("");
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) setName("");
        onOpenChange(value);
      }}
    >
      <DialogContent className="flex w-[400px] flex-col">
        <div className="flex items-center justify-between px-[30px] py-[20px]">
          <p className="text-[18px] font-medium leading-[28px] tracking-[-0.04px] text-black">
            새 제안서
          </p>
          <DialogClose aria-label="닫기" className="text-black">
            <XIcon className="size-[24px]" />
          </DialogClose>
        </div>
        <div className="px-[30px]">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="제안서 이름을 입력해 주세요."
            className="h-[54px] w-full rounded-[8px] border border-stroke px-[16px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-placeholder"
          />
        </div>
        <div className="px-[30px] py-[20px]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleCreate}
            disabled={!trimmed}
          >
            생성
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
