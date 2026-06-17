import Link from "next/link";

import { ChevronRightIcon, CircleCheckIcon, Logo } from "@/components/icons";
import { cn } from "@/lib/utils";

const OTHER_ROWS: [string, string][] = [
  ["대행사 선정에", "수주 소요"],
  ["제안서 작성에", "수일~수주"],
  ["전문 지식 없으면", "불가능"],
  ["영업 담당자에게", "강한 의존성"],
  ["별도 제안서", "제작 필요"],
  ["여러 창구", "문의 및 방문"],
];

const ADMIX_ROWS: [string, string][] = [
  ["AI와 대화로", "즉시 시작"],
  ["단시간에", "플래닝 완성"],
  ["누구든 전문가급", "전략 수립"],
  ["데이터 기반", "실제 매체 추천"],
  ["자동 즉시", "생성·다운로드"],
  ["문의·계약까지", "원스톱"],
];

const CARDS = [
  {
    badge: "방대한 정보를 쉽게 확인하고 싶을 때",
    title: "지도 위에서\n한눈에 보는 광고 매체",
    desc: "전국 광고 매체의 위치와 정보를\n지도 위에서 직관적으로 탐색할 수 있습니다.",
    image: "/service/card-map.png",
  },
  {
    badge: "광고 매체 선정이 고민될 때",
    title: "매체 탐색 및\nAI 추천 시스템",
    desc: "광고 목적, 타겟, 지역, 예산을 대화로\n분석하여 최적의 광고 매체를 추천해드립니다.",
    image: "/service/card-compass.png",
  },
  {
    badge: "복잡한 제안서 작성이 어려울 때",
    title: "제안서 즉시 발송\n그리고 집행",
    desc: "클릭 한 번으로 고품질 견적 제안서를 완성하고,\n계약까지 원스톱으로 관리할 수 있습니다.",
    image: "/service/card-disk.png",
  },
];

function AdmixLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex h-[48px] items-center gap-[4px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={dark ? "/service/admix-wordmark-dark.svg" : "/service/admix-wordmark-white.svg"}
        alt="ADMIX"
        className="h-[32px] w-[137px]"
      />
      <Logo className="size-[48px]" />
    </div>
  );
}

function CompareRow({
  items,
  variant,
}: {
  items: [string, string];
  variant: "other" | "admix";
}) {
  const isAdmix = variant === "admix";
  return (
    <div
      className={cn(
        "flex items-center gap-[12px] rounded-[4px] px-[24px] py-[16px]",
        isAdmix ? "bg-secondary" : "bg-[#eee]",
      )}
    >
      <CircleCheckIcon
        className={cn("size-[24px] shrink-0", isAdmix ? "text-primary" : "text-[#a9aab5]")}
      />
      <p className="text-base font-semibold leading-[24px]">
        <span className="text-[#757575]">{items[0]}</span>{" "}
        <span className={isAdmix ? "text-primary" : "text-[#757575]"}>{items[1]}</span>
      </p>
    </div>
  );
}

export function ServiceIntroView() {
  return (
    <div className="mx-auto flex w-full max-w-[1016px] flex-col px-[20px] pb-[80px] pt-[80px]">
      <section className="flex flex-col gap-[24px] pb-[68px]">
        <div className="flex flex-col gap-[4px]">
          <p className="text-[24px] font-semibold leading-[32px] tracking-[-0.1px] text-black">
            서비스 소개
          </p>
          <p className="text-base font-medium leading-[24px] text-[#737586]">
            회사 및 서비스 소개를 확인하세요
          </p>
        </div>
        <div className="relative flex aspect-[1016/500] w-full flex-col justify-center overflow-hidden rounded-[36px] px-[60px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/service/hero-bg.png"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/[0.08] to-black/80" />
          <div className="relative flex flex-col gap-[24px]">
            <AdmixLogo />
            <div className="flex flex-col">
              <p className="text-[32px] font-medium leading-[40px] tracking-[-0.16px] text-white">
                광고 캠페인을 AI와 대화로
              </p>
              <p className="text-base font-normal leading-[24px] text-[#e2e2e2]">
                탐색부터 계약까지 전 과정을 하나의 대화로 완성합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-[48px] py-[68px]">
        <h2 className="text-center text-[40px] font-semibold leading-[48px] tracking-[-0.4px] text-black">
          스타트업부터 중견기업까지
          <br />
          <span className="text-primary">전략적으로 함께 합니다</span>
        </h2>
        <div className="flex w-full justify-center px-[120px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/service/intro.png"
            alt=""
            className="h-[480px] w-[775px] max-w-full object-contain"
          />
        </div>
      </section>

      <section className="flex flex-col items-center gap-[48px] py-[68px]">
        <div className="flex flex-col items-center gap-[24px]">
          <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-primary">
            국내 최초 대화형 광고 플래닝 전문 기업
          </p>
          <h2 className="text-center text-[40px] font-semibold leading-[48px] tracking-[-0.4px] text-black">
            광고 캠페인 플래닝부터 계약까지
            <br />
            차별점을 직접 확인해 보세요
          </h2>
        </div>
        <div className="grid w-full grid-cols-2 items-start gap-[24px]">
          <div className="flex flex-col gap-[8px]">
            <div className="flex flex-col">
              <div className="flex items-center justify-center bg-[#737586] px-[10px] py-[20px]">
                <p className="text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-white">
                  타사 서비스
                </p>
              </div>
              <div className="flex items-center justify-center py-[20px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/service/compare-other.png"
                  alt=""
                  className="size-[180px] object-contain"
                />
              </div>
            </div>
            <div className="flex flex-col gap-[8px]">
              {OTHER_ROWS.map((items) => (
                <CompareRow key={items[0]} items={items} variant="other" />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-[8px]">
            <div className="flex flex-col">
              <div className="flex items-center justify-center bg-primary px-[10px] py-[20px]">
                <p className="text-[18px] font-semibold leading-[28px] tracking-[-0.04px] text-white">
                  ADMIX
                </p>
              </div>
              <div className="flex h-[220px] items-center justify-center py-[20px]">
                <AdmixLogo dark />
              </div>
            </div>
            <div className="flex flex-col gap-[8px]">
              {ADMIX_ROWS.map((items) => (
                <CompareRow key={items[0]} items={items} variant="admix" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center gap-[48px] py-[68px]">
        <div className="flex flex-col items-center gap-[24px]">
          <p className="text-[24px] font-bold leading-[32px] tracking-[-0.1px] text-primary">
            AI Planning
          </p>
          <h2 className="text-center text-[40px] font-semibold leading-[48px] tracking-[-0.4px] text-black">
            실제 매체 데이터와 AI가 만나
            <br />
            광고 기획의 정확도가 달라집니다.
          </h2>
        </div>
        <div className="grid w-full grid-cols-3 items-stretch gap-[16px]">
          {CARDS.map((card) => (
            <div
              key={card.badge}
              className="flex flex-col gap-[10px] rounded-[6px] border border-stroke bg-[#f8f8f8] px-[18px] py-[36px]"
            >
              <span className="inline-flex w-fit items-center rounded-[4px] bg-primary px-[6px] py-[2px] text-sm font-semibold leading-[20px] text-white">
                {card.badge}
              </span>
              <div className="flex w-full flex-col gap-[8px]">
                <div className="flex flex-col gap-[6px]">
                  <p className="whitespace-pre-line text-[24px] font-medium leading-[32px] tracking-[-0.1px] text-black">
                    {card.title}
                  </p>
                  <p className="whitespace-pre-line text-sm font-medium leading-[20px] text-[#757575]">
                    {card.desc}
                  </p>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={card.image}
                  alt=""
                  className="aspect-square w-full object-contain"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-[68px]">
        <div className="relative flex items-center overflow-hidden rounded-[36px] px-[60px] py-[80px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/service/cta-bg.png"
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="relative flex flex-col gap-[24px]">
            <div className="flex flex-col">
              <p className="text-[32px] font-medium leading-[40px] tracking-[-0.16px] text-white">
                AI와의 대화 한 번으로
                <br />
                <span className="text-primary">첫 캠페인</span>이 완성됩니다.
              </p>
              <p className="text-base font-normal leading-[24px] text-[#e2e2e2]">
                복잡한 기획 없이 지금 바로 시작해 보세요.
              </p>
            </div>
            <Link
              href="/fixed"
              className="flex w-fit items-center gap-[4px] rounded-[8px] bg-[#f1f5f9] px-[12px] py-[8px] text-sm font-medium text-black"
            >
              매체 둘러보기
              <ChevronRightIcon className="size-[18px]" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
