"use client";

import { Accordion, Button, Chip, Tag, TagGroup } from "@heroui/react";
import { MessageCircleQuestionIcon } from "lucide-react";
import { useState } from "react";

import { SearchOutlineIcon } from "@/components/icons";
import { usePublishedFaqs } from "@/hooks/faqs";
import { cn } from "@/lib/utils";

import { ContactEmptyState } from "./inquiryUtils";

const ALL = "전체";
const CATEGORIES = [ALL, "이용안내", "매체검색 & 기획안"];

// canonical faq_type(어드민) → 클라이언트 노출 카테고리
const TYPE_TO_CATEGORY: Record<string, string> = {
  "이용 안내": "이용안내",
  "매체검색&제안서": "매체검색 & 기획안",
};

// 분류 칩 32px → 곡률 13px. 매체 찾기 필터 칩과 같은 모양(선택 시 진한 테두리·굵은 글자).
const CATEGORY_TAG = cn(
  "flex h-[32px] shrink-0 items-center rounded-[13px] border border-gray-200 bg-white px-[14px] text-[13px] font-medium text-gray-600 transition-colors",
  "hover:border-gray-300",
  "data-[selected=true]:border-gray-400 data-[selected=true]:font-bold data-[selected=true]:text-gray-900",
);

type Faq = {
  id: string;
  category: string;
  question: string;
  answer: string;
};

function useFaqs(): Faq[] {
  const { data } = usePublishedFaqs();
  return (data ?? []).map((row) => ({
    id: row.id,
    category: TYPE_TO_CATEGORY[row.faq_type ?? ""] ?? row.faq_type ?? "",
    question: row.title,
    answer: row.content,
  }));
}

/**
 * 질문 목록 — HeroUI Accordion. 질문마다 따로 둥근 카드(곡률 16px, 사이 8px)라 구분선이 없다.
 * 마우스를 올리면 카드 전체 테두리가 진해지고 옅은 회색, 펼치면 카드 전체(질문+답변)가 옅은 회색.
 * Q·A 글자는 같은 폭(14px) 칸에 두어 질문과 답변 글이 같은 선에서 시작한다.
 */
function FaqAccordion({ items }: { items: Faq[] }) {
  return (
    <Accordion allowsMultipleExpanded className="flex flex-col gap-[8px]">
      {items.map((faq) => (
        <Accordion.Item
          key={faq.id}
          id={faq.id}
          // HeroUI가 항목에 border-none(선 모양 없음)을 걸어 두어 border-solid를 함께 준다.
          className="rounded-[16px] border border-solid border-[#ececef] bg-white transition-colors after:hidden hover:border-[#d4d4d8] hover:bg-[#fafafa] data-[expanded=true]:border-[#e4e4e7] data-[expanded=true]:bg-[#fafafa]"
        >
          <Accordion.Heading>
            {/* HeroUI 기본 hover 회색(질문 줄만 네모로 칠함)은 끄고, 카드 전체 hover를 쓴다. */}
            <Accordion.Trigger className="gap-[12px] rounded-[16px] px-[20px] py-[18px] hover:bg-transparent max-sm:px-[16px]">
              <span
                aria-hidden
                className="w-[14px] shrink-0 text-[15px] leading-[1.5] font-bold text-[#a1a1aa]"
              >
                Q
              </span>
              <span className="min-w-0 flex-1 text-[15px] leading-[1.5] font-semibold break-keep text-[#18181b]">
                {faq.question}
              </span>
              {faq.category && (
                <Chip className="h-[22px] shrink-0 rounded-[8px] bg-[#f1f1f3] px-[8px] py-0 text-[11px] font-medium text-[#71717a] max-sm:hidden">
                  {faq.category}
                </Chip>
              )}
              <Accordion.Indicator className="ms-0 size-[16px] text-[#a1a1aa]" />
            </Accordion.Trigger>
          </Accordion.Heading>
          <Accordion.Panel>
            {/* 답변 — 따로 칸 없이, 질문과 같은 들여쓰기(좌우 여백·Q/A 칸 폭이 같다). */}
            <Accordion.Body className="flex gap-[12px] px-[20px] pt-0 pb-[20px] max-sm:px-[16px]">
              <span
                aria-hidden
                className="w-[14px] shrink-0 text-[14px] leading-[1.7] font-bold text-[#a1a1aa]"
              >
                A
              </span>
              <p className="min-w-0 flex-1 text-[14px] leading-[1.7] break-keep whitespace-pre-line text-[#52525b]">
                {faq.answer}
              </p>
            </Accordion.Body>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  );
}

/** 자주 묻는 질문 탭 — 분류 칩 + 검색어로 거른 질문 목록. */
export function FaqPanel({
  query,
  onResetQuery,
}: {
  query: string;
  onResetQuery: () => void;
}) {
  const [category, setCategory] = useState(ALL);
  const faqs = useFaqs();

  const keyword = query.trim().toLowerCase();
  const items = faqs.filter(
    (faq) =>
      (category === ALL || faq.category === category) &&
      (!keyword ||
        faq.question.toLowerCase().includes(keyword) ||
        faq.answer.toLowerCase().includes(keyword)),
  );
  const filtered = category !== ALL || !!keyword;

  return (
    // 질문이 없을 때 빈 상태가 탭 아래 남는 높이를 채우도록 패널도 늘어난다.
    <div className="flex flex-1 flex-col gap-[16px]">
      <TagGroup
        aria-label="질문 분류"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([category])}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next != null) setCategory(String(next));
        }}
      >
        <TagGroup.List className="flex flex-wrap gap-[8px]">
          {CATEGORIES.map((value) => (
            <Tag key={value} id={value} className={CATEGORY_TAG}>
              {value}
            </Tag>
          ))}
        </TagGroup.List>
      </TagGroup>

      {items.length > 0 ? (
        <FaqAccordion items={items} />
      ) : filtered ? (
        <ContactEmptyState
          icon={<SearchOutlineIcon className="size-[22px]" />}
          title="찾는 질문이 없어요"
          description="다른 검색어를 입력하거나 분류를 바꿔 보세요"
        >
          <Button
            variant="outline"
            onPress={() => {
              setCategory(ALL);
              onResetQuery();
            }}
            className="mt-[8px] h-[36px] rounded-[15px] px-[16px] text-[13px] font-semibold"
          >
            검색 조건 초기화
          </Button>
        </ContactEmptyState>
      ) : (
        <ContactEmptyState
          icon={<MessageCircleQuestionIcon className="size-[24px]" />}
          title="등록된 질문이 아직 없어요"
          description="궁금한 점은 문의 접수 탭에서 편하게 남겨 주세요"
        />
      )}
    </div>
  );
}
