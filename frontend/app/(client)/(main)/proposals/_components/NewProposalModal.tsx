"use client";

import { useState } from "react";

import { Button } from "@/components/common/buttons";
import { XIcon } from "@/components/icons";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function NewProposalModal({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 성공이면 null, 실패면 인라인으로 표시할 에러 문구를 반환.
  onCreate: (name: string) => Promise<string | null>;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();

  const reset = () => {
    setName("");
    setError(null);
    setSubmitting(false);
  };

  const handleCreate = async () => {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    const message = await onCreate(trimmed);
    setSubmitting(false);
    if (message) {
      setError(message);
      return;
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) reset();
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
        <div className="flex flex-col gap-[8px] px-[30px]">
          <input
            type="text"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            placeholder="제안서 이름을 입력해 주세요."
            className={cn(
              "h-[54px] w-full rounded-[8px] border border-stroke px-[16px] text-sm font-medium leading-[20px] text-black outline-none placeholder:text-placeholder",
              error && "border-red-500",
            )}
          />
          {error && (
            <p className="text-sm font-medium leading-[20px] text-red-500">
              {error}
            </p>
          )}
        </div>
        <div className="px-[30px] py-[20px]">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleCreate}
            disabled={!trimmed || submitting}
          >
            생성
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
