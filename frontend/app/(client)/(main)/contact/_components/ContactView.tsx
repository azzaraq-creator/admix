"use client";

import { useEffect, useState, type ReactNode } from "react";

import { CircleCheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

const TABS_GUEST = ["문의 접수", "자주 묻는 질문"];
const TABS_MEMBER = ["문의 접수", "문의 내역", "자주 묻는 질문"];

const INQUIRY_TYPES = ["매체 및 상품 문의", "견적 및 제안 관련 문의", "기타 문의"];

const NOTICES = [
  "실시간 상담은 운영시간 내에 이용 가능합니다.",
  "로그인한 사용자의 문의 내용은 고객지원 > 문의 내역에서 확인할 수 있습니다.",
];

const PHONE = "02-1234-5678";
const EMAIL = "email@gmail.com";

function Icon({ name, className }: { name: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/icons/${name}.svg`} alt="" className={className} />;
}

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

function ContactCard({
  highlight,
  children,
  footer,
}: {
  highlight?: boolean;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-[492px] min-w-[300px] flex-1 flex-col items-center rounded-[12px] border px-[32px] py-[20px]",
        highlight ? "border-primary bg-[#f4fbfa]" : "border-stroke bg-white",
      )}
    >
      <div className="flex h-[452px] w-full flex-col items-center justify-between">
        <div className="flex w-full flex-col items-center justify-center gap-[24px]">
          {children}
        </div>
        {footer}
      </div>
    </div>
  );
}

export function ContactView({ member = false }: { member?: boolean }) {
  const [toast, setToast] = useState<string | null>(null);
  const tabs = member ? TABS_MEMBER : TABS_GUEST;

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
    <div className="mx-auto flex w-full max-w-[1016px] flex-col gap-[16px] px-[20px] pb-[40px] pt-[80px]">
      <div className="flex flex-col gap-[4px]">
        <p className="text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black">
          문의하기
        </p>
        <p className="text-base font-medium leading-[24px] text-[#737586]">
          궁금한 내용을 확인하거나 문의를 남겨보세요.
        </p>
      </div>

      <div className="flex items-center border-b border-stroke">
        {tabs.map((tab, index) => (
          <button
            key={tab}
            type="button"
            className={cn(
              "-mb-px px-[10px] py-[10px] text-base font-medium leading-[24px]",
              index === 0
                ? "border-b-2 border-primary text-primary"
                : "text-[#737586]",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-stretch gap-[24px]">
        <ContactCard
          highlight
          footer={
            <div className="flex w-full flex-col gap-[8px]">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] bg-[#fddc37] px-[16px] py-[12px] text-base font-medium text-[#2f3442]"
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
            <button
              type="button"
              onClick={() => copy(PHONE)}
              className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
            >
              <Icon name="copy" className="size-[24px]" />
              전화번호 복사
            </button>
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
            <div className="flex w-full flex-col items-center gap-[2px] rounded-[8px] bg-[#f6f6f6] py-[8px] text-center">
              <p className="text-base font-medium leading-[24px] text-black">
                운영시간
              </p>
              <div className="flex flex-col items-center">
                <p className="text-base font-medium leading-[24px] text-black">
                  평일 09:00 ~ 18:00
                </p>
                <p className="text-sm font-medium leading-[20px] text-[#737586]">
                  (주말 및 공휴일 휴무)
                </p>
              </div>
            </div>
          </div>
        </ContactCard>

        <ContactCard
          footer={
            member ? (
              <button
                type="button"
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
              >
                <Icon name="square-pen" className="size-[24px]" />
                문의 작성하기
              </button>
            ) : (
              <button
                type="button"
                onClick={() => copy(EMAIL)}
                className="flex w-full items-center justify-center gap-[8px] rounded-[8px] border border-primary bg-white px-[16px] py-[12px] text-base font-medium text-primary"
              >
                <Icon name="square-pen" className="size-[24px]" />
                메일주소 복사
              </button>
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
                <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-primary">
                  {EMAIL}
                </p>
              )}
            </div>
            <div className="flex w-full flex-col items-start gap-[10px] px-[32px]">
              {INQUIRY_TYPES.map((type) => (
                <div key={type} className="flex w-full items-center gap-[13px]">
                  <span className="size-[8px] shrink-0 rounded-full bg-[#2f3442]" />
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
            <p className="text-sm font-medium leading-[20px] text-[#737586]">
              자주 묻는 질문에서 궁금증을 빠르게 해결할 수 있습니다.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center justify-center gap-[4px] rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
        >
          자주 묻는 질문 보기
        </button>
      </div>

      <div className="relative flex items-center gap-[24px] overflow-hidden rounded-[12px] border border-stroke px-[24px] py-[14px]">
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <p className="text-sm font-semibold leading-[20px] text-black">
            안내 사항
          </p>
          <div className="flex flex-col gap-[6px]">
            {NOTICES.map((notice) => (
              <div key={notice} className="flex w-full items-center gap-[8px]">
                <span className="size-[6px] shrink-0 rounded-full bg-[#737586]" />
                <p className="flex-1 text-sm font-medium leading-[20px] text-[#737586]">
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

      {toast && (
        <div className="fixed bottom-[36px] left-1/2 z-50 flex -translate-x-1/2 items-center gap-[16px] rounded-[8px] bg-[#2f3442] px-[20px] py-[14px] shadow-lg">
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
