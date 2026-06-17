"use client";

import { useState } from "react";

import { PlusIcon, XIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const CATEGORIES = ["전체", "이용안내", "매체검색 & 제안서"];

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

const FAQS: Faq[] = [
  {
    id: "f1",
    category: "매체검색 & 제안서",
    question: "Cham는 어떤 서비스인가요?",
    answer:
      "광고 매체를 접하고싶은 모든 유저가 사용할 수 있고 신청할 수 있는 간단한 서비스 입니다.\n해당 서비스는 무료로 제공되며 비회원일 경우 일부 기능이 제한됩니다.",
  },
  {
    id: "f2",
    category: "매체검색 & 제안서",
    question: "광고 매체는 어떻게 검색하나요?",
    answer:
      "지도 또는 검색창에서 지역과 키워드로 원하는 광고 매체를 직관적으로 탐색할 수 있습니다.",
  },
  {
    id: "f3",
    category: "매체검색 & 제안서",
    question: "제안서는 어떻게 받을 수 있나요?",
    answer:
      "관심 있는 매체를 담은 뒤 제안서 담기를 통해 견적 제안서를 자동으로 생성하고 다운로드할 수 있습니다.",
  },
  {
    id: "f4",
    category: "매체검색 & 제안서",
    question: "추천 매체는 어떤 기준으로 제공되나요?",
    answer:
      "광고 목적, 타겟, 지역, 예산을 대화로 분석하여 데이터 기반으로 최적의 매체를 추천해드립니다.",
  },
  {
    id: "f5",
    category: "이용안내",
    question: "회원가입 없이 이용할 수 있나요?",
    answer:
      "비회원도 매체 탐색은 가능하지만, 제안서 저장과 문의 내역 확인 등 일부 기능은 로그인 후 이용할 수 있습니다.",
  },
  {
    id: "f6",
    category: "이용안내",
    question: "서비스 이용 요금이 있나요?",
    answer: "기본 매체 탐색 및 AI 추천 기능은 무료로 제공됩니다.",
  },
  {
    id: "f7",
    category: "이용안내",
    question: "문의한 내용은 어디서 확인하나요?",
    answer: "로그인 후 고객지원 > 문의 내역 메뉴에서 확인할 수 있습니다.",
  },
];

function ToggleButton({
  open,
  onClick,
  invisible,
}: {
  open: boolean;
  onClick?: () => void;
  invisible?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "답변 접기" : "답변 펼치기"}
      className={cn(
        "flex size-[32px] shrink-0 items-center justify-center rounded-full bg-white text-[#2f3442] drop-shadow-[0px_0px_2px_rgba(0,0,0,0.12)]",
        invisible && "invisible",
      )}
    >
      {open ? (
        <XIcon className="size-[10px]" />
      ) : (
        <PlusIcon className="size-[10px]" />
      )}
    </button>
  );
}

function FaqItem({
  faq,
  open,
  onToggle,
}: {
  faq: Faq;
  open: boolean;
  onToggle: () => void;
}) {
  if (open) {
    return (
      <div className="flex flex-col gap-[12px] rounded-[16px] border border-stroke bg-[#f9fafa] px-[16px] py-[24px]">
        <div className="flex w-full items-center gap-[24px]">
          <div className="flex min-w-0 flex-1 items-center gap-[36px]">
            <p className="w-[120px] shrink-0 text-base font-semibold leading-[24px] text-primary">
              {faq.category}
            </p>
            <p className="text-base font-semibold leading-[24px] text-black">
              {faq.question}
            </p>
          </div>
          <ToggleButton open onClick={onToggle} />
        </div>
        <div className="flex w-full items-start gap-[24px]">
          <div className="flex min-w-0 flex-1 gap-[36px]">
            <div className="w-[120px] shrink-0" />
            <p className="flex-1 whitespace-pre-line text-sm font-medium leading-[20px] text-[#737586]">
              {faq.answer}
            </p>
          </div>
          <ToggleButton open invisible />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[24px] rounded-[16px] border border-stroke bg-white px-[16px] py-[24px]">
      <div className="flex min-w-0 flex-1 items-center gap-[36px]">
        <p className="w-[120px] shrink-0 text-base font-semibold leading-[24px] text-primary">
          {faq.category}
        </p>
        <p className="text-base font-semibold leading-[24px] text-black">
          {faq.question}
        </p>
      </div>
      <ToggleButton open={false} onClick={onToggle} />
    </div>
  );
}

export function FaqPanel({ query }: { query: string }) {
  const [category, setCategory] = useState("전체");
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(["f1"]));

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const keyword = query.trim();
  const items = FAQS.filter(
    (faq) =>
      (category === "전체" || faq.category === category) &&
      (!keyword ||
        faq.question.includes(keyword) ||
        faq.answer.includes(keyword)),
  );

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="flex flex-wrap items-center gap-[10px] py-[6px]">
        {CATEGORIES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={cn(
              "rounded-full px-[12px] py-[6px] text-base font-medium leading-[24px]",
              category === value
                ? "bg-primary text-white"
                : "bg-[#f1f5f9] text-[#2f3442]",
            )}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-[12px]">
        {items.map((faq) => (
          <FaqItem
            key={faq.id}
            faq={faq}
            open={openIds.has(faq.id)}
            onToggle={() => toggle(faq.id)}
          />
        ))}
      </div>
    </div>
  );
}
