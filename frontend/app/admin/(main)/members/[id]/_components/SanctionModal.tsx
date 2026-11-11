"use client";

import {
  Button,
  Calendar,
  ListBox,
  Modal,
  Popover,
  Select,
  TextArea,
} from "@heroui/react";
import {
  getLocalTimeZone,
  parseDate,
  today as todayOf,
  type CalendarDate,
} from "@internationalized/date";
import { CalendarDays } from "lucide-react";
import { useState } from "react";

import { XIcon } from "@/components/icons";
import {
  useCreateSanction,
  useDeleteSanction,
  useUpdateSanction,
  type SanctionOut,
} from "@/hooks/members";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

const REASON_OPTIONS = [
  "허위 사업자 정보 등록",
  "서비스 정책 위반",
  "부적절한 광고 목적",
  "스팸 및 반복 행위",
  "기타(직접입력)",
].map((r) => ({ value: r, label: r }));

// 저장 형식("YYYY-MM-DD") → HeroUI Calendar 값(CalendarDate). 읽을 수 없으면 비운다.
function toCalendarDate(s?: string): CalendarDate | undefined {
  if (!s) return undefined;
  try {
    return parseDate(s);
  } catch {
    return undefined;
  }
}

/**
 * 날짜 하나 고르기 — 버튼을 누르면 HeroUI Popover 안에 Calendar 가 뜨고, 고르면 닫힌다.
 * 오늘 이전은 고를 수 없고, minDate · maxDate 로 범위를 더 좁힌다.
 */
function PeriodDateField({
  label,
  value,
  onChange,
  minDate,
  maxDate,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minDate?: string; // 이 날짜 이전 비활성(시작일 등)
  maxDate?: string; // 이 날짜 이후 비활성(종료일 등)
}) {
  const [open, setOpen] = useState(false);
  const selected = toCalendarDate(value);
  const today = todayOf(getLocalTimeZone());
  // 하한 = 오늘과 minDate 중 더 늦은 날(항상 오늘 이후만 선택 가능).
  const min = toCalendarDate(minDate);
  const floor = min && min.compare(today) > 0 ? min : today;
  const max = toCalendarDate(maxDate);
  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        aria-label={`${label} ${value || "날짜 선택"}`}
        className="min-w-0 flex-1 justify-between"
      >
        <span className={value ? "text-black" : "text-tone-8f8f8f"}>
          {value || "날짜 선택"}
        </span>
        <CalendarDays className="size-[14px] text-tone-727272" />
      </Button>
      <Popover.Content placement="bottom start">
        <Popover.Dialog aria-label={label}>
          <Calendar
            aria-label={label}
            value={selected ?? null}
            defaultFocusedValue={selected ?? floor}
            minValue={floor}
            maxValue={max}
            onChange={(d) => {
              onChange(d.toString());
              setOpen(false);
            }}
          >
            <Calendar.Header>
              <Calendar.Heading />
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
          </Calendar>
        </Popover.Dialog>
      </Popover.Content>
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
    <>
      {/* 부르는 쪽이 열 때만 그리므로 늘 열린 상태 — 바깥 · Esc · 닫기 버튼은 onClose. */}
      <Modal
        isOpen
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <Modal.Backdrop>
          <Modal.Container placement="center" className="px-[16px] sm:px-0">
            <Modal.Dialog
              aria-label="활동 정지"
              className="flex w-[600px] max-w-full flex-col gap-[24px] rounded-[12px] bg-surface p-[44px]"
            >
              <Modal.CloseTrigger
                aria-label="닫기"
                className="right-[40px] top-[40px] size-[32px] rounded-full bg-transparent p-0 text-black data-[hovered=true]:bg-gray-50"
              >
                <XIcon className="size-[24px]" />
              </Modal.CloseTrigger>
              <Modal.Header className="p-0 pr-[40px]">
                <Modal.Heading className="text-[20px] font-semibold leading-[24px] text-tone-202224">
                  활동 정지
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="mt-0 flex flex-col gap-[24px] text-base">
                <div className="flex w-full items-center border-b border-tone-f3f2f0">
                  <span className="flex h-[48px] w-[160px] shrink-0 items-center bg-tone-f5f5f5 px-[24px] text-[16px] leading-[24px] text-tone-555555">
                    회원ID
                  </span>
                  <span className="flex-1 px-[24px] text-[16px] leading-[24px] text-tone-2a2a2a">
                    {memberEmail}
                  </span>
                </div>

                <div className="flex w-full flex-col gap-[12px]">
                  <Select
                    aria-label="정지 사유"
                    placeholder="정지 사유 선택"
                    fullWidth
                    selectedKey={reason || null}
                    onSelectionChange={(key) =>
                      setReason(key == null ? "" : String(key))
                    }
                  >
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {REASON_OPTIONS.map((o) => (
                          <ListBox.Item
                            key={o.value}
                            id={o.value}
                            textValue={o.label}
                          >
                            {o.label}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>

                  <TextArea
                    variant="secondary"
                    fullWidth
                    aria-label="정지 사유 상세"
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="해당 회원을 정지하려는 사유를 입력해주세요."
                    className="min-h-[160px] resize-y p-[20px] text-[16px] leading-[24px]"
                  />

                  <div className="flex flex-col gap-[8px]">
                    <p className="text-[16px] font-semibold leading-[1.5] text-tone-555555">
                      제재 기간 선택
                    </p>
                    <div className="flex items-center gap-[10px]">
                      <PeriodDateField
                        label="제재 시작일"
                        value={startDate}
                        onChange={setStartDate}
                        maxDate={endDate || undefined}
                      />
                      <span className="text-[12px] text-tone-727272">-</span>
                      <PeriodDateField
                        label="제재 종료일"
                        value={endDate}
                        onChange={setEndDate}
                        minDate={startDate || undefined}
                      />
                    </div>
                  </div>
                </div>
              </Modal.Body>

              <Modal.Footer className="mt-0 flex w-full gap-[12px]">
                {editing && (
                  <Button
                    variant="tertiary"
                    size="lg"
                    className="h-[64px] flex-1 text-[18px] font-semibold"
                    onPress={handleDelete}
                    isDisabled={pending}
                  >
                    삭제
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="lg"
                  className="h-[64px] flex-1 text-[18px] font-semibold"
                  onPress={handleSave}
                  isDisabled={!canSave}
                >
                  저장
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
      {confirmDialog}
    </>
  );
}
