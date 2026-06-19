"use client";

import { useState } from "react";

import { PlusIcon, XIcon } from "@/components/icons";
import { usePublishedFaqs } from "@/hooks/faqs";
import { cn } from "@/lib/utils";

const CATEGORIES = ["전체", "이용안내", "매체검색 & 제안서"];

// canonical faq_type(어드민) → 클라이언트 노출 카테고리
const TYPE_TO_CATEGORY: Record<string, string> = {
  "이용 안내": "이용안내",
  "매체검색&제안서": "매체검색 & 제안서",
};

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

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
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const { data } = usePublishedFaqs();

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const keyword = query.trim();
  const items: Faq[] = (data ?? [])
    .map((row) => ({
      id: row.id,
      category: TYPE_TO_CATEGORY[row.faq_type ?? ""] ?? (row.faq_type ?? ""),
      question: row.title,
      answer: row.content,
    }))
    .filter(
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
