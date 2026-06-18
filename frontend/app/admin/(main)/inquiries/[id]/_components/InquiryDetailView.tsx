"use client";

import { useRouter } from "next/navigation";

import { ListButton, PrimaryButton } from "@/components/admin/buttons";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

import { InquiryStatusBadge } from "../../_components";

const CARD_CLASS =
  "rounded-[8px] border border-[#e5e7eb] bg-white p-[44px] shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]";

function InfoRow({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`flex gap-[16px] ${full ? "col-span-2" : ""}`}>
      <span className="w-[120px] shrink-0 pt-[2px] text-base font-semibold leading-[24px] text-[#6d6d6d]">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-sm font-medium leading-[22px] text-black">
        {children}
      </div>
    </div>
  );
}

export function InquiryDetailView() {
  const router = useRouter();
  const { confirm, alert, confirmDialog } = useAdminConfirm();

  const handleComplete = async () => {
    const ok = await confirm({
      title: "답변 완료 처리를 하시겠습니까?",
      description: "작성한 답변 내용이 고객에게 전달됩니다.",
      confirmText: "전송",
    });
    if (!ok) return;
    await alert({
      title: "답변 처리 완료",
      description: "답변 처리가 완료되었습니다.",
      confirmText: "확인",
    });
  };

  return (
    <div className="flex flex-col gap-[32px]">
      <div className={`flex flex-col gap-[24px] ${CARD_CLASS}`}>
        <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
          문의 상세
        </h1>
        <div className="grid grid-cols-2 gap-x-[48px] gap-y-[20px]">
          <InfoRow label="문의자">홍길동동</InfoRow>
          <InfoRow label="이메일">hong@gmail.com</InfoRow>
          <InfoRow label="전화번호">010-1234-5678</InfoRow>
          <InfoRow label="회사">ADMIX</InfoRow>
          <InfoRow label="제출일">2026-05-01</InfoRow>
          <InfoRow label="문의 상태">
            <InquiryStatusBadge status="답변 대기" />
          </InfoRow>
          <InfoRow label="문의 제목" full>
            광고 매체 관련 문의
          </InfoRow>
          <InfoRow label="문의 내용" full>
            문의 내용의 임시 요약본입니다.문의 내용의 임시 요약본입니다.문의 내용의
            임시 요약본입니다.문의 내용의 임시 요약본입니다.문의 내용의 임시
            요약본입니다.문의 내용의 임시 요약본입니다.문의 내용의 임시
            요약본입니다.문의 내용의 임시 요약본입니다.문의 내용의 임시
            요약본입니다.문의 내용의 임시 요약본입니다.문의 내용의 임시
            요약본입니다.
          </InfoRow>
        </div>
      </div>

      <div className={`flex flex-col gap-[24px] ${CARD_CLASS}`}>
        <h2 className="text-xl font-semibold leading-[28px] text-[#2a2a2a]">
          답변 정보
        </h2>
        <div className="grid grid-cols-2 gap-x-[48px]">
          <InfoRow label="답변자">-</InfoRow>
          <InfoRow label="답변 일시">-</InfoRow>
        </div>
        <textarea
          placeholder="답변 내용을 입력해 주세요."
          className="h-[160px] w-full resize-none rounded-[8px] border border-[#f2f2f2] bg-[#f0f0f3] p-[20px] text-base leading-[24px] text-black outline-none placeholder:text-[#8f8f8f]"
        />
        <div className="flex items-center justify-between">
          <ListButton onClick={() => router.push("/admin/inquiries")} />
          <PrimaryButton onClick={handleComplete}>답변 완료 처리</PrimaryButton>
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
