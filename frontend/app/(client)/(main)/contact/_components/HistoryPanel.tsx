"use client";

import { useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type Inquiry = {
  id: string;
  title: string;
  status: "waiting" | "answered";
  name: string;
  email: string;
  phone: string;
  company: string;
  subject: string;
  submittedAt: string;
  content: string;
  answer?: { date: string; body: string };
};

const SAMPLE_CONTENT =
  "광고 매체 관련 문의 임시 내용입니다. 광고 매체 관련 문의 임시 내용입니다. 광고 매체 관련 문의 임시 내용입니다. 광고 매체 관련 문의 임시 내용입니다. 광고 매체 관련 문의 임시 내용입니다. 광고 매체 관련 문의 임시 내용입니다.";

const SAMPLE_ANSWER =
  "고객지원으로부터의 답변 내용입니다. 고객지원으로부터의 답변 내용입니다. 고객지원으로부터의 답변 내용입니다. 고객지원으로부터의 답변 내용입니다. 고객지원으로부터의 답변 내용입니다. 고객지원으로부터의 답변 내용입니다.";

const base = {
  name: "임현우",
  email: "test@naver.com",
  phone: "010-1234-5678",
  company: "(주)아우라웍스",
  subject: "광고 매체 관련 문의",
  submittedAt: "2026.05.01 14:00",
  content: SAMPLE_CONTENT,
};

const INQUIRIES: Inquiry[] = [
  { id: "q1", title: "문의 1", status: "waiting", ...base },
  { id: "q2", title: "문의 2", status: "waiting", ...base },
  {
    id: "q3",
    title: "문의 3",
    status: "answered",
    ...base,
    answer: { date: "2026.06.01 17:41", body: SAMPLE_ANSWER },
  },
  {
    id: "q4",
    title: "문의 4",
    status: "answered",
    ...base,
    answer: { date: "2026.06.01 17:41", body: SAMPLE_ANSWER },
  },
  {
    id: "q5",
    title: "문의 5",
    status: "answered",
    ...base,
    answer: { date: "2026.06.01 17:41", body: SAMPLE_ANSWER },
  },
  {
    id: "q6",
    title: "문의 6",
    status: "answered",
    ...base,
    answer: { date: "2026.06.01 17:41", body: SAMPLE_ANSWER },
  },
  {
    id: "q7",
    title: "문의 7",
    status: "answered",
    ...base,
    answer: { date: "2026.06.01 17:41", body: SAMPLE_ANSWER },
  },
];

function StatusChip({ status }: { status: Inquiry["status"] }) {
  const waiting = status === "waiting";
  return (
    <span
      className={cn(
        "shrink-0 rounded-[6px] px-[10px] py-[4px] text-xs font-medium leading-[16px] tracking-[0.0048px]",
        waiting ? "bg-[#fff3d3] text-[#ff920a]" : "bg-secondary text-primary",
      )}
    >
      {waiting ? "답변 대기" : "답변 완료"}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-[310px] flex-1 items-center gap-[24px]">
      <p className="w-[58px] shrink-0 text-[#757575]">{label}</p>
      <p className="text-[#2f3442]">{value}</p>
    </div>
  );
}

function InquiryDetail({
  inquiry,
  onBack,
}: {
  inquiry: Inquiry;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-[24px]">
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-[4px] text-sm font-medium text-[#737586]"
      >
        <ChevronLeftIcon className="size-[16px]" />
        목록으로
      </button>

      <div className="flex flex-col gap-[12px]">
        <div className="flex items-center gap-[12px]">
          <p className="text-base font-bold leading-[26px] tracking-[-0.4px] text-black">
            내 문의
          </p>
          <StatusChip status={inquiry.status} />
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
            <Field label="제출일" value={inquiry.submittedAt} />
          </div>
          <div className="flex w-full items-start gap-[24px]">
            <p className="shrink-0 text-[#757575]">문의 내용</p>
            <p className="min-w-0 flex-1 text-[#2f3442]">{inquiry.content}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        <p className="text-base font-bold leading-[26px] tracking-[-0.4px] text-black">
          답변 내용
        </p>
        {inquiry.answer ? (
          <div className="flex flex-col gap-[16px] rounded-[12px] border border-primary bg-[#f4fbfa] p-[24px]">
            <div className="flex flex-col">
              <p className="text-base font-semibold leading-[26px] tracking-[-0.4px] text-primary">
                ADMIX 고객지원
              </p>
              <p className="text-sm font-medium leading-[22px] tracking-[-0.35px] text-[#737586]">
                답변일 : {inquiry.answer.date}
              </p>
            </div>
            <p className="text-base font-medium leading-[32px] tracking-[-0.4px] text-[#2f3442]">
              {inquiry.answer.body}
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
  );
}

export function HistoryPanel({ query }: { query: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = INQUIRIES.find((item) => item.id === selectedId) ?? null;
  if (selected) {
    return (
      <InquiryDetail inquiry={selected} onBack={() => setSelectedId(null)} />
    );
  }

  const keyword = query.trim();
  const items = INQUIRIES.filter(
    (item) => !keyword || item.title.includes(keyword) || item.subject.includes(keyword),
  );

  return (
    <div className="flex flex-col gap-[12px]">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedId(item.id)}
          className="flex w-full items-center gap-[24px] rounded-[16px] border border-stroke bg-white px-[16px] py-[24px]"
        >
          <div className="flex min-w-0 flex-1 items-center gap-[36px]">
            <StatusChip status={item.status} />
            <p className="text-base font-semibold leading-[24px] text-black">
              {item.title}
            </p>
          </div>
          <ChevronRightIcon className="size-[20px] shrink-0 text-[#2f3442]" />
        </button>
      ))}
    </div>
  );
}
