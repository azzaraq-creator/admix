"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/common/buttons";
import { Icon } from "@/components/common/Icon";
import { CircleCheckIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { ContactCard } from "./ContactCard";
import { FaqPanel } from "./FaqPanel";
import { HistoryPanel } from "./HistoryPanel";
import { InquiryModal } from "./InquiryModal";

type TabKey = "received" | "history" | "faq";

const TABS_GUEST: { key: TabKey; label: string }[] = [
  { key: "received", label: "문의 접수" },
  { key: "faq", label: "자주 묻는 질문" },
];
const TABS_MEMBER: { key: TabKey; label: string }[] = [
  { key: "received", label: "문의 접수" },
  { key: "history", label: "문의 내역" },
  { key: "faq", label: "자주 묻는 질문" },
];

const INQUIRY_TYPES = [
  "매체 및 상품 문의",
  "견적 및 제안 관련 문의",
  "기타 문의",
];

const NOTICES = [
  "실시간 상담은 운영시간 내에 이용 가능합니다.",
  "로그인한 사용자의 문의 내용은 고객지원 > 문의 내역에서 확인할 수 있습니다.",
];

const PHONE = "02-582-4560";
const EMAIL = "admix.support@gmail.com";

function Badge({ invisible }: { invisible?: boolean }) {
  return (
    <div className={cn("flex w-full items-start", invisible && "invisible")}>
      <span className="rounded-[4px] bg-secondary px-[8px] py-[2px] text-sm font-medium leading-[20px] text-primary">
        가장 빠른 상담
      </span>
    </div>
  );
}

function IconCircle({
  highlight,
  children,
}: {
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center rounded-full p-[16px]",
        highlight ? "bg-primary" : "bg-[#eee]",
      )}
    >
      {children}
    </div>
  );
}

export function ContactView({ member = false }: { member?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const tabs = member ? TABS_MEMBER : TABS_GUEST;
  const tabParam = searchParams.get("tab");
  const activeTab: TabKey = tabs.some((tab) => tab.key === tabParam)
    ? (tabParam as TabKey)
    : "received";
  const showSearch = activeTab === "faq" || activeTab === "history";

  const goTab = (key: TabKey) =>
    router.push(key === "received" ? "/contact" : `/contact?tab=${key}`, {
      scroll: false,
    });

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(id);
  }, [toast]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      void error;
    }
    setToast("복사가 완료되었습니다.");
  };

  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[16px] px-[20px] pb-[40px] pt-[24px] sm:pt-[80px]">
      <div className="flex flex-col gap-[4px]">
        <p className="text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black">
          문의하기
        </p>
        <p className="text-base font-medium leading-[24px] text-disabled">
          궁금한 내용을 확인하거나 문의를 남겨보세요.
        </p>
      </div>

      <div className="flex flex-col gap-[8px] border-b border-stroke py-[8px] sm:h-[52px] sm:flex-row sm:items-end sm:justify-between sm:gap-0 sm:py-0">
        <div className="flex items-end">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => goTab(tab.key)}
              className={cn(
                "-mb-px px-[10px] py-[10px] text-base font-medium leading-[24px]",
                activeTab === tab.key
                  ? "text-primary sm:border-b-2 sm:border-primary"
                  : "text-disabled",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {showSearch && (
          <div className="flex w-full items-center gap-[10px] rounded-[6px] border border-stroke px-[16px] py-[12px] sm:mb-[8px] sm:h-[44px] sm:w-[298px] sm:py-0">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="검색어를 입력하세요."
              className="min-w-0 flex-1 text-sm font-medium leading-[20px] text-black outline-none placeholder:text-grey-500"
            />
            <SearchIcon className="size-[16px] shrink-0 text-grey-500" />
          </div>
        )}
      </div>

      {activeTab === "received" && (
        <div className="flex flex-col gap-[16px]">
          <div className="flex flex-wrap items-stretch gap-[24px]">
            <ContactCard
              highlight
              footer={
                <div className="flex w-full flex-col gap-[8px]">
                  <button
                    type="button"
                    onClick={() =>
                      window.open("http://pf.kakao.com/_PaSXX/chat", "_blank")
                    }
                    className="flex w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#fddc37] px-[16px] py-[12px] text-base font-medium text-black"
                  >
                    <Icon name="kakao" className="size-[24px]" />
                    카카오톡 상담
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-[#00c300] px-[16px] py-[12px] text-base font-medium text-[#00c300]"
                  >
                    <Icon name="naver" className="size-[24px]" />
                    네이버톡 상담
                  </button>
                </div>
              }
            >
              <Badge />
              <div className="flex w-full flex-col items-center gap-[20px]">
                <IconCircle highlight>
                  <Icon name="message-circle-white" className="size-[32px]" />
                </IconCircle>
                <div className="flex w-full flex-col items-center gap-[10px] text-center">
                  <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-primary">
                    실시간 상담
                  </p>
                  <p className="text-base font-medium leading-[24px] text-black">
                    카카오톡 또는 네이버톡으로
                    <br />
                    실시간 상담을 받아보세요.
                  </p>
                </div>
                <div className="flex w-full items-center justify-center gap-[6px] rounded-[6px] bg-secondary py-[8px]">
                  <Icon name="clock" className="size-[18px]" />
                  <p className="text-base font-semibold leading-[24px] text-black">
                    평균 응답 시간 10분 이내
                  </p>
                </div>
              </div>
            </ContactCard>

            <ContactCard
              footer={
                <Button
                  variant="tertiary"
                  size="md"
                  fullWidth
                  onClick={() => copy(PHONE)}
                  leftIcon={<Icon name="copy" className="size-[24px]" />}
                >
                  전화번호 복사
                </Button>
              }
            >
              <Badge invisible />
              <div className="flex w-full flex-col items-center gap-[20px]">
                <IconCircle>
                  <Icon name="phone" className="size-[32px]" />
                </IconCircle>
                <div className="flex w-full flex-col items-center gap-[10px] text-center">
                  <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-black">
                    전화 문의
                  </p>
                  <p className="text-base font-medium leading-[24px] text-black">
                    운영시간 내 전화로
                    <br />
                    상담을 도와드립니다.
                  </p>
                  <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-primary">
                    {PHONE}
                  </p>
                </div>
                <div className="flex w-full flex-col items-center gap-[2px] rounded-[8px] bg-grey-50 py-[8px] text-center">
                  <p className="text-base font-medium leading-[24px] text-black">
                    운영시간
                  </p>
                  <div className="flex flex-col items-center">
                    <p className="text-base font-medium leading-[24px] text-black">
                      평일 09:00 ~ 18:00
                    </p>
                    <p className="text-sm font-medium leading-[20px] text-disabled">
                      (주말 및 공휴일 휴무)
                    </p>
                  </div>
                </div>
              </div>
            </ContactCard>

            <ContactCard
              footer={
                member ? (
                  <Button
                    variant="tertiary"
                    size="md"
                    fullWidth
                    onClick={() => setModalOpen(true)}
                    leftIcon={
                      <Icon name="square-pen" className="size-[24px]" />
                    }
                  >
                    문의 작성하기
                  </Button>
                ) : (
                  <Button
                    variant="tertiary"
                    size="md"
                    fullWidth
                    onClick={() => copy(EMAIL)}
                    leftIcon={
                      <Icon name="square-pen" className="size-[24px]" />
                    }
                  >
                    메일주소 복사
                  </Button>
                )
              }
            >
              <Badge invisible />
              <div className="flex w-full flex-col items-center gap-[20px]">
                <IconCircle>
                  <Icon name="square-pen" className="size-[32px]" />
                </IconCircle>
                <div className="flex w-full flex-col items-center gap-[10px] text-center">
                  <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-black">
                    문의 접수
                  </p>
                  <p className="text-base font-medium leading-[24px] text-black">
                    문의 내용을 작성해 주시면
                    <br />
                    확인 후 답변드리겠습니다.
                  </p>
                  {!member && (
                    <p className="text-[20px] font-bold leading-[28px] tracking-[-0.08px] text-primary">
                      {EMAIL}
                    </p>
                  )}
                </div>
                <div className="flex w-full flex-col items-start gap-[10px] px-[32px]">
                  {INQUIRY_TYPES.map((type) => (
                    <div
                      key={type}
                      className="flex w-full items-center gap-[13px]"
                    >
                      <span className="size-[8px] shrink-0 rounded-full bg-black" />
                      <p className="text-base font-medium leading-[24px] text-black">
                        {type}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </ContactCard>
          </div>

          <div className="flex flex-wrap items-center gap-x-[24px] gap-y-[12px] rounded-[12px] border border-stroke px-[24px] py-[14px]">
            <div className="flex min-w-[300px] max-w-[812px] flex-1 items-center gap-[27px]">
              <div className="flex shrink-0 items-center rounded-full bg-secondary p-[10px]">
                <Icon name="megaphone" className="size-[24px]" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <p className="text-base font-medium leading-[24px] text-black">
                  문의 전 확인해 보세요
                </p>
                <p className="text-sm font-medium leading-[20px] text-disabled">
                  자주 묻는 질문에서 궁금증을 빠르게 해결할 수 있습니다.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goTab("faq")}
              className="ml-[68px] shrink-0 sm:ml-0"
            >
              자주 묻는 질문 보기
            </Button>
          </div>

          <div className="relative flex items-center gap-[24px] overflow-hidden rounded-[12px] border border-stroke px-[24px] py-[14px]">
            <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
              <p className="text-sm font-semibold leading-[20px] text-black">
                안내 사항
              </p>
              <div className="flex flex-col gap-[6px]">
                {NOTICES.map((notice) => (
                  <div
                    key={notice}
                    className="flex w-full items-center gap-[8px]"
                  >
                    <span className="size-[6px] shrink-0 rounded-full bg-disabled" />
                    <p className="flex-1 text-sm font-medium leading-[20px] text-disabled">
                      {notice}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-0 right-0 h-[72px] w-[150px] opacity-20">
              <Icon
                name="message-circle-teal"
                className="absolute bottom-[14px] right-[60px] size-[63px]"
              />
              <Icon
                name="message-circle-gray"
                className="absolute bottom-[14px] right-[24px] size-[50px] -scale-x-100"
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <HistoryPanel
          query={searchQuery}
          onSelect={(id) => router.push(`/contact/inquiries/${id}`)}
        />
      )}

      {activeTab === "faq" && <FaqPanel query={searchQuery} />}

      <InquiryModal open={modalOpen} onClose={() => setModalOpen(false)} />

      {toast && (
        <div className="fixed bottom-[36px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-[16px] rounded-[8px] bg-black px-[20px] py-[14px] shadow-lg">
          <span className="flex items-center gap-[8px] text-sm font-medium text-white">
            <CircleCheckIcon className="size-[20px] text-[#22c55e]" />
            {toast}
          </span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-sm font-medium text-[#a9aab5]"
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
