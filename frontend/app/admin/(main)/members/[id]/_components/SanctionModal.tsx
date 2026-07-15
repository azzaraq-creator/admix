"use client";

import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { XIcon } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateSanction,
  useDeleteSanction,
  useUpdateSanction,
  type SanctionOut,
} from "@/hooks/members";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";
import { cn } from "@/lib/utils";

const REASON_OPTIONS = [
  "허위 사업자 정보 등록",
  "서비스 정책 위반",
  "부적절한 광고 목적",
  "스팸 및 반복 행위",
  "기타(직접입력)",
].map((r) => ({ value: r, label: r }));

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDate(s?: string): Date | undefined {
  return s ? new Date(`${s}T00:00:00`) : undefined;
}

function DateField({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (v: string) => void;
  minDate?: string; // 이 날짜 이전 비활성(시작일 등)
  maxDate?: string; // 이 날짜 이후 비활성(종료일 등)
}) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 하한 = 오늘과 minDate 중 더 늦은 날(항상 오늘 이후만 선택 가능).
  const min = parseDate(minDate);
  const floor = min && min > today ? min : today;
  const max = parseDate(maxDate);
  const disabled = [
    { before: floor },
    ...(max ? [{ after: max }] : []),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="flex flex-1 items-center justify-between rounded-[6px] border border-[#ebebeb] px-[12px] py-[10px] text-[13px] font-medium outline-none">
        <span className={value ? "text-black" : "text-[#8f8f8f]"}>
          {value || "날짜 선택"}
        </span>
        <CalendarDays className="size-[14px] text-[#727272]" />
      </PopoverTrigger>
      <PopoverContent>
        <Calendar
          mode="single"
          defaultMonth={selected ?? floor}
          selected={selected}
          onSelect={(d) => {
            if (!d) return;
            onChange(toDateStr(d));
            setOpen(false);
          }}
          disabled={disabled}
        />
      </PopoverContent>
    </Popover>
  );
}

export function SanctionModal({
  memberId,
  memberEmail,
  sanction,
  onClose,
}: {
  memberId: string;
  memberEmail: string;
  sanction?: SanctionOut | null;
  onClose: () => void;
}) {
  const editing = sanction != null;
  const { confirm, confirmDialog } = useAdminConfirm();
  const createMutation = useCreateSanction();
  const updateMutation = useUpdateSanction();
  const deleteMutation = useDeleteSanction();

  const [reason, setReason] = useState(sanction?.reason ?? "");
  const [detail, setDetail] = useState(sanction?.detail ?? "");
  const [startDate, setStartDate] = useState(sanction?.start_date ?? "");
  const [endDate, setEndDate] = useState(sanction?.end_date ?? "");

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const canSave = reason !== "" && startDate !== "" && !pending;

  const handleSave = async () => {
    if (!canSave) return;
    const payload = {
      reason,
      detail: detail.trim() || null,
      start_date: startDate,
      end_date: endDate || null,
    };
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          id: memberId,
          sanctionId: sanction.id,
          payload,
        });
      } else {
        await createMutation.mutateAsync({ id: memberId, payload });
      }
      onClose();
    } catch {
      // 실패 시 모달 유지
    }
  };

  const handleDelete = async () => {
    if (!editing || pending) return;
    const ok = await confirm({
      title: "제재를 삭제하시겠습니까?",
      description: "삭제하면 해당 제재 이력이 제거됩니다.",
      confirmText: "삭제",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync({
        id: memberId,
        sanctionId: sanction.id,
      });
      onClose();
    } catch {
      // 실패 시 모달 유지
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex w-[600px] max-w-[calc(100vw-32px)] flex-col gap-[24px] rounded-[12px] p-[44px]">
        <div className="flex w-full items-start justify-between">
          <DialogTitle className="text-[20px] font-semibold leading-[24px] text-[#202224]">
            활동 정지
          </DialogTitle>
          <button type="button" onClick={onClose} aria-label="닫기">
            <XIcon className="size-[24px] text-black" />
          </button>
        </div>

        <div className="flex w-full items-center border-b border-[#f3f2f0]">
          <span className="flex h-[48px] w-[160px] shrink-0 items-center bg-[#f5f5f5] px-[24px] text-[16px] leading-[24px] text-[#555]">
            회원ID
          </span>
          <span className="flex-1 px-[24px] text-[16px] leading-[24px] text-[#2a2a2a]">
            {memberEmail}
          </span>
        </div>

        <div className="flex w-full flex-col gap-[12px]">
          <Select
            items={REASON_OPTIONS}
            value={reason || null}
            onValueChange={(v) => setReason(v ?? "")}
          >
            <SelectTrigger className="h-[40px] w-full rounded-[6px] border-[#ebebeb] bg-white px-[12px] text-[14px] font-medium text-black data-[size=default]:h-[40px]">
              <SelectValue placeholder="정지 사유 선택" />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false} className="min-w-0">
              {REASON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="해당 회원을 정지하려는 사유를 입력해주세요."
            className="min-h-[160px] w-full resize-y rounded-[8px] border border-[#f2f2f2] bg-[#f0f0f3] p-[20px] text-[16px] leading-[24px] text-black outline-none placeholder:text-[#8f8f8f]"
          />

          <div className="flex flex-col gap-[8px]">
            <p className="text-[16px] font-semibold leading-[1.5] text-[#555]">
              제재 기간 선택
            </p>
            <div className="flex items-center gap-[10px]">
              <DateField
                value={startDate}
                onChange={setStartDate}
                maxDate={endDate || undefined}
              />
              <span className="text-[12px] text-[#727272]">-</span>
              <DateField
                value={endDate}
                onChange={setEndDate}
                minDate={startDate || undefined}
              />
            </div>
          </div>
        </div>

        <div className="flex w-full gap-[12px]">
          {editing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="flex flex-1 items-center justify-center rounded-[4px] bg-platinum-100 py-[20px] text-[18px] font-semibold leading-[24px] text-black disabled:opacity-50"
            >
              삭제
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex flex-1 items-center justify-center rounded-[4px] py-[20px] text-[18px] font-semibold leading-[24px] text-white",
              canSave ? "bg-primary" : "bg-[#cdcdcd]",
            )}
          >
            저장
          </button>
        </div>
      </DialogContent>
      {confirmDialog}
    </Dialog>
  );
}
