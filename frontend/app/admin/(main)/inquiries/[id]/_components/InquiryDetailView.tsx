"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { ListButton, PrimaryButton } from "@/components/common/buttons";
import { extractApiError } from "@/lib/apiError";
import { useAnswerInquiry, useInquiry, type InquiryDetail } from "@/hooks/inquiries";
import { useAdminConfirm } from "@/hooks/useAdminConfirm";

import { InquiryStatusBadge, type InquiryStatus } from "../../_components";

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
  const params = useParams<{ id: string }>();
  const { data: inquiry } = useInquiry(params.id);

  if (!inquiry) {
    return (
      <p className="text-sm font-medium leading-[20px] text-[#737586]">
        불러오는 중...
      </p>
    );
  }

  return <InquiryDetail inquiry={inquiry} />;
}

function InquiryDetail({ inquiry }: { inquiry: InquiryDetail }) {
  const router = useRouter();
  const { confirm, alert, confirmDialog } = useAdminConfirm();
  const answerMutation = useAnswerInquiry();

  const [answer, setAnswer] = useState(inquiry.answer ?? "");
  // 답변 완료된 문의는 수정 불가(읽기 전용).
  const answered = inquiry.status === "답변 완료";

  const handleComplete = async () => {
    if (!answer.trim()) {
      await alert({
        title: "입력 확인",
        description: "답변 내용을 입력해주세요.",
        confirmText: "확인",
      });
      return;
    }
    const ok = await confirm({
      title: "답변 완료 처리를 하시겠습니까?",
      description: "작성한 답변 내용이 고객에게 전달됩니다.",
      confirmText: "전송",
    });
    if (!ok) return;
    try {
      await answerMutation.mutateAsync({ id: inquiry.id, answer: answer.trim() });
      await alert({
        title: "답변 처리 완료",
        description: "답변 처리가 완료되었습니다.",
        confirmText: "확인",
      });
    } catch (err) {
      await alert({
        title: "처리 실패",
        description: extractApiError(err, "처리 중 오류가 발생했습니다."),
        confirmText: "확인",
      });
    }
  };

  return (
    <div className="flex flex-col gap-[32px]">
      <div className={`flex flex-col gap-[24px] ${CARD_CLASS}`}>
        <h1 className="text-2xl font-semibold leading-[32px] text-[#2a2a2a]">
          문의 상세
        </h1>
        <div className="grid grid-cols-2 gap-x-[48px] gap-y-[20px]">
          <InfoRow label="문의자">{inquiry.name}</InfoRow>
          <InfoRow label="이메일">{inquiry.email ?? "-"}</InfoRow>
          <InfoRow label="전화번호">{inquiry.phone ?? "-"}</InfoRow>
          <InfoRow label="회사">{inquiry.company ?? "-"}</InfoRow>
          <InfoRow label="제출일">{inquiry.submittedAt}</InfoRow>
          <InfoRow label="문의 상태">
            <InquiryStatusBadge status={inquiry.status as InquiryStatus} />
          </InfoRow>
          <InfoRow label="문의 제목" full>
            {inquiry.subject}
          </InfoRow>
          <InfoRow label="문의 내용" full>
            <p className="whitespace-pre-line">{inquiry.content}</p>
          </InfoRow>
        </div>
      </div>

      <div className={`flex flex-col gap-[24px] ${CARD_CLASS}`}>
        <h2 className="text-xl font-semibold leading-[28px] text-[#2a2a2a]">
          답변 정보
        </h2>
        <div className="grid grid-cols-2 gap-x-[48px]">
          <InfoRow label="답변자">{inquiry.answerer ?? "-"}</InfoRow>
          <InfoRow label="답변 일시">
            {inquiry.answeredAt?.slice(0, 10) ?? "-"}
          </InfoRow>
        </div>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          readOnly={answered}
          placeholder="답변 내용을 입력해 주세요."
          className={`h-[160px] w-full resize-none rounded-[8px] border border-[#f2f2f2] p-[20px] text-base leading-[24px] text-black outline-none placeholder:text-[#8f8f8f] ${
            answered ? "cursor-default bg-[#f6f6f6]" : "bg-[#f0f0f3]"
          }`}
        />
        <div className="flex items-center justify-between">
          <ListButton onClick={() => router.push("/admin/inquiries")} />
          {!answered && (
            <PrimaryButton
              onClick={handleComplete}
              disabled={answerMutation.isPending}
            >
              답변 완료 처리
            </PrimaryButton>
          )}
        </div>
      </div>

      {confirmDialog}
    </div>
  );
}
