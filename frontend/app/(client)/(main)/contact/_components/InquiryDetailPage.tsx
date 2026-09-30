"use client";

import { Button, Separator, Spinner } from "@heroui/react";

import { ChevronLeftIcon, Logo, TrashOutlineIcon } from "@/components/icons";
import { useDeleteMyInquiry, useMyInquiry } from "@/hooks/inquiries";
import { useModalConfirm } from "@/hooks/useModalConfirm";
import { useSonner } from "@/hooks/useSonner";
import { formatPhone } from "@/lib/phone";

import { formatDateTime, InquiryStatusChip } from "./inquiryUtils";

/** 긴 글(문의·답변 본문) — 15px, 넉넉한 줄 간격, 한글은 단어 단위로 줄바꿈. */
const BODY_TEXT =
  "text-[15px] leading-[1.8] break-keep whitespace-pre-wrap text-[#27272a]";

export function InquiryDetailPage({
  id,
  onBack,
}: {
  id: string;
  onBack: () => void;
}) {
  const { data: inquiry, isLoading, refetch } = useMyInquiry(id);
  const deleteInquiry = useDeleteMyInquiry();
  const { confirm, confirmDialog } = useModalConfirm();
  const { success, error } = useSonner();

  // 삭제는 답변 대기 중일 때만 — 답변이 달린 문의는 기록으로 남긴다(서버도 409로 막는다).
  const canDelete = inquiry?.status === "pending";

  const handleDelete = async () => {
    const ok = await confirm({
      title: "문의를 삭제할까요?",
      description: "삭제한 문의는 되돌릴 수 없어요.",
      confirmText: "삭제",
      destructive: true,
    });
    if (!ok) return;
    deleteInquiry.mutate(id, {
      onSuccess: () => {
        success("문의를 삭제했어요.");
        onBack();
      },
      onError: (err) => {
        const status = (err as { response?: { status?: number } })?.response
          ?.status;
        if (status === 409) {
          // 확인하는 사이 답변이 달렸다 — 최신 상태로 다시 보여 준다.
          error("답변이 등록된 문의는 삭제할 수 없어요.");
          void refetch();
        } else {
          error("문의를 삭제하지 못했어요. 다시 시도해 주세요.");
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-[20px]">
      <div className="flex items-center justify-between gap-[12px]">
        <Button
          variant="ghost"
          onPress={onBack}
          className="-ml-[8px] h-[32px] w-fit gap-[4px] rounded-[13px] px-[8px] text-[13px] font-medium text-[#52525b]"
        >
          <ChevronLeftIcon className="size-[16px]" />
          문의 내역
        </Button>
        {/* 문의 삭제 — 답변 대기일 때만 보인다. 버튼 32px → 곡률 13px, 삭제라 빨간 글자. */}
        {canDelete && (
          <Button
            variant="ghost"
            onPress={() => void handleDelete()}
            isPending={deleteInquiry.isPending}
            className="-mr-[8px] h-[32px] gap-[6px] rounded-[13px] px-[8px] text-[13px] font-medium text-[#dc2626] data-[hovered=true]:bg-[#fef2f2]"
          >
            <TrashOutlineIcon className="size-[15px]" />
            문의 삭제
          </Button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center py-[72px]">
          <Spinner />
        </div>
      )}

      {inquiry && (
        <>
          <header className="flex flex-col gap-[10px]">
            <InquiryStatusChip status={inquiry.status} />
            <h1 className="text-[24px] leading-[1.4] font-bold break-keep text-black max-sm:text-[20px]">
              {inquiry.subject}
            </h1>
            {/* 문의 정보 — 따로 카드를 두지 않고 제목 아래 회색 두 줄(일시 / 작성자 정보). 비어 있는 값은 뺀다. */}
            <div className="flex flex-col gap-[2px] text-[13px] leading-[1.6] text-[#8c8c94]">
              <p>
                접수 {formatDateTime(inquiry.createdAt, { seconds: true })}
                {inquiry.answeredAt && (
                  <>
                    <span aria-hidden className="mx-[6px] text-[#d4d4d8]">
                      ·
                    </span>
                    답변 {formatDateTime(inquiry.answeredAt, { seconds: true })}
                  </>
                )}
              </p>
              {/* 작성자 정보 — 항목마다 옅은 이름표 + 진한 값을 한 덩어리로(이름표가 구분 역할이라 점·아이콘은 없다).
                  넘치면 항목 단위로 다음 줄로 가고, 한 항목이 폭보다 길면(긴 이메일 등) 말줄임. */}
              <dl className="flex flex-wrap gap-x-[14px] gap-y-[2px]">
                {[
                  { label: "이름", value: inquiry.name },
                  { label: "이메일", value: inquiry.email },
                  {
                    label: "전화번호",
                    value: inquiry.phone && formatPhone(inquiry.phone),
                  },
                  { label: "회사", value: inquiry.company },
                ]
                  .filter((item) => item.value)
                  .map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex max-w-full min-w-0 items-baseline gap-[5px]"
                    >
                      <dt className="shrink-0 text-[12px] text-[#a1a1aa]">
                        {label}
                      </dt>
                      <dd className="truncate text-[#52525b]">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </header>

          {/* 문의 내용 — 박스 없이 구분선 아래 본문 글로 바로 이어진다. */}
          <Separator className="bg-[#f1f1f3]" />
          {/* 짧은 문의("ㅎㅎ" 등)도 답변 카드가 바로 붙지 않게 최소 높이 — PC 160px(본문 약 6줄), 모바일 120px. */}
          <p className={`${BODY_TEXT} min-h-[160px] max-sm:min-h-[120px]`}>
            {inquiry.content}
          </p>

          {/* 답변 — 채팅 메시지처럼: 왼쪽 프로필(ADMIX 로고) + 이름·시각 + 연회색 말풍선.
              대기 중이면 같은 자리에 "입력 중" 점 세 개 말풍선과 안내 한 줄. */}
          <Separator className="bg-[#f1f1f3]" />
          <div className="flex gap-[12px]">
            <span className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-[#f4f4f5]">
              <Logo className="size-[18px]" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <p className="flex items-baseline gap-[8px]">
                <span className="text-[14px] font-semibold text-[#18181b]">
                  {inquiry.answererName || "ADMIX 고객지원"}
                </span>
                {inquiry.answer && (
                  <span className="text-[12px] text-[#a1a1aa]">
                    {formatDateTime(inquiry.answeredAt)}
                  </span>
                )}
              </p>
              {inquiry.answer ? (
                // 말풍선 — 프로필 쪽(왼쪽 위) 모서리만 덜 둥글게.
                <div className="w-fit max-w-full rounded-[18px] rounded-tl-[4px] bg-[#f4f4f5] px-[16px] py-[12px]">
                  <p className={BODY_TEXT}>{inquiry.answer}</p>
                </div>
              ) : (
                <>
                  {/* 입력 중 — 점 세 개가 차례로 튄다(움직임 줄이기 설정이면 멈춘다). */}
                  <div
                    role="status"
                    aria-label="담당자가 확인하고 있어요"
                    className="flex w-fit items-center gap-[4px] rounded-[18px] rounded-tl-[4px] bg-[#f4f4f5] px-[16px] py-[14px]"
                  >
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        aria-hidden
                        className="size-[6px] rounded-full bg-[#a1a1aa] motion-safe:animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                  <p className="text-[12px] break-keep text-[#8c8c94]">
                    담당자가 확인하고 있어요 · 영업일 기준 1~2일 안에 답변드려요
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {confirmDialog}
    </div>
  );
}
