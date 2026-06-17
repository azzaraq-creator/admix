"use client";

import { CircleAlertIcon, FileUpIcon } from "@/components/icons";

import { ProfileModalShell } from "./ProfileModalShell";

const NOTICES = [
  "사업자등록증 정보는 계약 관련 용도로 사용됩니다.",
  "변경 시, 검토 후 3영업일 이내 반영됩니다.",
];

export function BusinessRegisterModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ProfileModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="사업자등록증 변경"
      onSubmit={() => onOpenChange(false)}
    >
      <div className="flex flex-col gap-[20px]">
        <div className="flex flex-col gap-[12px]">
          <p className="text-sm font-medium leading-[20px] text-[#737586]">
            새로운 사업자등록증을 업로드해주세요.
          </p>
          <button
            type="button"
            className="flex h-[162px] flex-col items-center justify-center gap-[12px] rounded-[8px] border border-dashed border-stroke"
          >
            <div className="flex size-[72px] items-center justify-center rounded-[12px] bg-[#f6f6f6]">
              <FileUpIcon className="size-[32px] text-[#757575]" />
            </div>
            <div className="flex flex-col items-center gap-[6px]">
              <p className="text-sm font-medium leading-[20px] text-black">
                파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-xs font-medium leading-[16px] text-[#737586]">
                PDF 형식, 최대 10MB
              </p>
            </div>
          </button>
        </div>

        <div className="h-px w-full bg-stroke" />

        <div className="flex items-start gap-[8px]">
          <CircleAlertIcon className="mt-[1px] size-[18px] shrink-0 text-[#737586]" />
          <div className="flex flex-col gap-[8px]">
            <p className="text-sm font-semibold leading-[16px] text-[#2f3442]">
              안내 사항
            </p>
            <div className="flex flex-col gap-[6px]">
              {NOTICES.map((notice) => (
                <div key={notice} className="flex items-center gap-[12px]">
                  <span className="size-[4px] shrink-0 rounded-full bg-[#737586]" />
                  <p className="text-xs font-medium leading-[16px] text-[#737586]">
                    {notice}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ProfileModalShell>
  );
}
