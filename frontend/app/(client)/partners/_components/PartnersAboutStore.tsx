"use client";

import { MaskIcon } from "@/components/common/MaskIcon";
import { cn } from "@/lib/utils";

import {
  AboutFrame,
  AboutHero,
  CenterHead,
  InfoCards,
  NoteRow,
  SplitSection,
  StepTimeline,
  type Step,
} from "./aboutShared";
import { ABOUT_BRAND_HREF, ImageSlot, sample, useReveal } from "./landingKit";

/*
 * /partners/about/store — 매장 참여 방법(11-23 사용자: 소개 첫 화면 "매장 참여 방법 보기" → "매장 참여 절차 안내 페이지").
 * 위에서 아래로: 참여 조건(세 카드) → 가입 절차(가입 정보 · 협약서 작성 · 매장 연결 + 사업자등록증) → 콜라보 참여 순서
 *   → 참여 전 확인 사항 → 보라 시작 띠(매장으로 시작하기 · 브랜드 협업 구성 보기).
 * 글은 가입 화면(JoinFlow · PartnerStoreLink) · 협약서(agreement.json 제2 · 4조) · 콜라보 상세 "참여 안내" · 사업자 인증 잠금(ProvisionalGate)에 있는 사실만.
 */

/** 참여 조건 — 소개 이용 방법의 매장 세 카드와 같은 아이콘 · 말(11-23 사용자 문구). 설치 · 철수에 남은 물품 회수를 더했다(콜라보 상세 "admix가 해 줘요"). */
const BASICS = [
  {
    icon: "/icons/fill-collabo.svg",
    title: "무료 제휴 등록",
    body: "등록비와 정기 이용료 없이 매장을 등록합니다.",
  },
  {
    icon: "/icons/handshake.svg",
    title: "콜라보별 참여 결정",
    body: "콜라보 일정과 협업 내용을 확인하고 참여 여부를 직접 정합니다.",
  },
  {
    icon: "/icons/fill-box.svg",
    title: "설치 · 철수 지원",
    body: "설치가 필요한 콜라보는 미리 협의한 범위에서 admix가 설치 · 철수와 남은 물품 회수를 맡습니다.",
  },
];

/** 가입 절차 — 가입 화면 세 단계(JoinFlow: 가입 정보 → 협약서 작성 → 매장 연결). */
const JOIN = [
  {
    title: "가입 정보",
    body: "이메일이나 카카오 · 네이버로 가입하고, 상호 · 사업자 번호 · 대표자명 · 주소를 적습니다.",
  },
  {
    title: "협약서 작성",
    body: "기본협약서를 읽고 전자 서명합니다. 1년 동안 유효하고, 갱신 거절이 없으면 1년씩 자동 갱신됩니다.",
  },
  {
    title: "매장 연결",
    body: "매장 ID가 있으면 연결을 요청합니다. 처음 등록하는 매장은 admix 담당자가 등록해 연결합니다.",
  },
];

/** 콜라보 참여 순서 — 콜라보 상세의 단계 버튼(신청 · 대기 신청 · 최종 확정 · 사진 올리기 · 재입고 요청) · 참여 안내 그대로. */
const STEPS: Step[] = [
  {
    title: "모집 확인",
    who: ["partner"],
    body: "콜라보 참여 메뉴에서 모집 중인 콜라보의 내용 · 일정 · 받는 것을 봅니다.",
  },
  {
    title: "참여 신청",
    who: ["partner"],
    body: "모집 마감까지 참여 · 미참여를 알립니다. 신청은 선착순이고, 목표 매장이 다 차면 대기 신청을 할 수 있습니다.",
  },
  {
    title: "최종 확정",
    who: ["brand", "partner"],
    body: "브랜드 검토 뒤 확정 요청이 오면, 진행 항목을 모두 확인하고 매장이 직접 확정합니다. 확정 요청 전까지는 참여를 취소할 수 있습니다.",
  },
  {
    title: "설치",
    who: ["admix"],
    body: "admix가 매장에 방문해 설치합니다.",
  },
  {
    title: "진행 · 점검",
    who: ["partner"],
    body: "점검일에 남은 수량이 보이게 사진 한 장을 올립니다. 빨리 줄면 재입고를 요청합니다.",
  },
  {
    title: "철수",
    who: ["admix"],
    body: "끝나면 admix가 철수하고 남은 물품을 회수합니다.",
  },
];

/** 참여 전 확인 사항 — 콜라보 상세 "받는 것 · 참여 안내", 내 매장 수정 요청. */
const NOTES = [
  {
    title: "받는 것",
    body: "콜라보마다 정한 혜택을 콜라보 시작 전에 받습니다.",
  },
  {
    title: "한 번에 한 건",
    body: "매장 한 곳은 한 번에 콜라보 1건을 진행합니다. 기간이 겹치는 모집에는 신청할 수 없습니다.",
  },
  {
    title: "확정 뒤 취소",
    body: "확정 후 진행이 어려우면 금전 책임은 없지만, 이후 매칭에 참고됩니다.",
  },
  {
    title: "매장 정보",
    body: "매장 정보 · 사진 · 가능 범위는 내 매장에서 봅니다. 바꿀 내용은 수정 요청으로 보냅니다.",
  },
];

export function PartnersAboutStore({ member = false }: { member?: boolean }) {
  return (
    <AboutFrame
      member={member}
      role="partner"
      bandTitle="매장으로 콜라보 시작"
      sibling={{ href: ABOUT_BRAND_HREF, label: "브랜드 협업 구성 보기" }}
      hero={
        <AboutHero
          chip="매장"
          title="매장 참여 방법"
          lead="가입부터 콜라보 진행까지 순서대로 안내합니다."
          image={sample("about-store")}
        />
      }
    >
      <section>
        <CenterHead
          eyebrow="참여 조건"
          title={
            <>
              비용 없이
              <br />
              <span className="text-primary">원하는 콜라보만 참여</span>
            </>
          }
          lead="협약만으로는 참여 의무가 생기지 않습니다."
        />
        <ul className="mt-[40px] grid gap-[12px] sm:mt-[64px] sm:grid-cols-3 sm:gap-[16px]">
          {BASICS.map((b, i) => (
            <BasicCard key={b.title} item={b} index={i} />
          ))}
        </ul>
      </section>

      <section>
        <CenterHead
          eyebrow="가입 절차"
          title={
            <>
              가입부터 매장 연결까지
              <br />
              <span className="text-primary">세 단계</span>
            </>
          }
          lead="가입 화면에서 순서대로 진행합니다."
        />
        <div className="mt-[40px] sm:mt-[64px]">
          <InfoCards items={JOIN} />
        </div>
        <NoteRow
          chip="확인"
          title="사업자등록증"
          body="콜라보 내용을 보고 신청하려면 사업자등록증 확인이 필요합니다. 가입할 때나 가입 뒤 내 정보에서 올립니다."
        />
      </section>

      <SplitSection
        eyebrow="콜라보 참여"
        title={
          <>
            모집부터
            <br />
            철수까지
          </>
        }
        lead="참여할 콜라보는 매장이 직접 고릅니다."
        aside={
          <ImageSlot
            src={sample("flow-4")}
            sizes="(min-width: 1024px) 460px, 100vw"
            className="mt-[32px] hidden h-[280px] rounded-[24px] lg:block"
          />
        }
      >
        <StepTimeline steps={STEPS} />
      </SplitSection>

      <section>
        <CenterHead eyebrow="알아 둘 것" title="참여 전 확인 사항" />
        <div className="mt-[40px] sm:mt-[64px]">
          <InfoCards items={NOTES} cols={2} numbered={false} />
        </div>
      </section>
    </AboutFrame>
  );
}

/** 참여 조건 카드 — 보라 네모 아이콘 · 제목 · 설명(소개 이용 방법 카드와 같은 모양). */
function BasicCard({
  item,
  index: i,
}: {
  item: (typeof BASICS)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>(i * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col rounded-[20px] bg-gray-50 p-[20px] sm:min-h-[200px] sm:p-[24px]",
        reveal.className,
      )}
    >
      <span className="flex size-[36px] items-center justify-center rounded-[11px] bg-primary text-white">
        <MaskIcon src={item.icon} className="size-[18px]" />
      </span>
      <h3 className="mt-[20px] text-[17px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:mt-auto sm:pt-[28px] sm:text-[19px]">
        {item.title}
      </h3>
      <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500">
        {item.body}
      </p>
    </li>
  );
}
