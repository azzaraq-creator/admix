"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { useMyInquiry } from "@/hooks/inquiries";

import { formatDateTime, InquiryStatusChip } from "./inquiryUtils";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-w-[310px] flex-1 items-center gap-[24px]">
      <p className="w-[58px] shrink-0 text-[#757575]">{label}</p>
      <p className="text-[#2f3442]">{value || "-"}</p>
    </div>
  );
}

export function InquiryDetailPage({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const { data: inquiry } = useMyInquiry(id);

  return (
    <div className="flex flex-col gap-[24px]">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-[6px] text-base font-bold leading-[24px] text-[#2f3442]"
      >
        <ChevronLeftIcon className="size-[24px]" />
        뒤로가기
      </button>

      {inquiry && (
        <div className="flex flex-col gap-[24px]">
          <div className="flex flex-col gap-[12px]">
            <div className="flex items-center gap-[12px]">
              <p className="text-base font-bold leading-[26px] tracking-[-0.4px] text-[#2f3442]">
                내 문의
              </p>
              <InquiryStatusChip status={inquiry.status} />
            </div>
            <div className="flex flex-col gap-[16px] rounded-[12px] border border-stroke bg-white p-[24px] text-base font-medium leading-[26px] tracking-[-0.4px]">
              <div className="flex flex-wrap items-start gap-x-[16px] gap-y-[12px]">
                <Field label="이름" value={inquiry.name} />
                <Field label="이메일" value={inquiry.email} />
              </div>
              <div className="flex flex-wrap items-start gap-[16px]">
                <Field label="전화번호" value={inquiry.phone} />
                <Field label="회사" value={inquiry.company} />
              </div>
              <div className="flex flex-wrap items-start gap-[16px]">
                <Field label="제목" value={inquiry.subject} />
                <Field label="제출일" value={formatDateTime(inquiry.createdAt)} />
              </div>
              <div className="flex w-full items-start gap-[24px]">
                <p className="shrink-0 text-[#757575]">문의 내용</p>
                <p className="min-w-0 flex-1 whitespace-pre-wrap text-[#2f3442]">
                  {inquiry.content}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-[12px]">
            <p className="text-base font-bold leading-[26px] tracking-[-0.4px] text-[#2f3442]">
              답변 내용
            </p>
            {inquiry.answer ? (
              <div className="flex flex-col gap-[16px] rounded-[12px] border border-primary bg-[#f4fbfa] p-[24px]">
                <div className="flex flex-col">
                  <p className="text-base font-semibold leading-[26px] tracking-[-0.4px] text-primary">
                    {inquiry.answererName || "ADMIX 고객지원"}
                  </p>
                  <p className="text-sm font-medium leading-[22px] tracking-[-0.35px] text-[#737586]">
                    답변일 : {formatDateTime(inquiry.answeredAt)}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-base font-medium leading-[32px] tracking-[-0.4px] text-[#2f3442]">
                  {inquiry.answer}
                </p>
              </div>
            ) : (
              <div className="rounded-[12px] border border-stroke p-[24px]">
                <p className="text-base font-medium leading-[26px] tracking-[-0.4px] text-[#737586]">
                  현재 문의가 정상적으로 접수되었습니다. 담당자가 확인 후 답변을
                  등록할 예정입니다.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
