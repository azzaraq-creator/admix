"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

import { ArrowLeftIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import {
  ActorChips,
  BackToTop,
  bodyClass,
  CtaLink,
  Eyebrow,
  H2,
  ImageSlot,
  LEAD,
  Reveal,
  StartActions,
  StartBand,
  useCollabStart,
  useReveal,
  type Actor,
} from "./landingKit";

/*
 * 콜라보 소개 하위 안내 페이지(11-23 사용자) — 브랜드 협업 구성(/partners/about/brand) · 매장 참여 방법(/partners/about/store).
 * 소개(PartnersLanding)와 같은 모양 · 말투: 제목은 명사로 맺고 설명은 합니다체 짧은 문장, 숫자는 화면 · 협약서에 있는 값만.
 * 위에서 아래로: 사진 띠 머리(← 콜라보 소개 · 칩 · 제목 · 한 줄) → 구역들 → 보라 시작 띠(그 쪽 가입 버튼 + 다른 안내 페이지) → 맨 위로.
 */

/**
 * 하위 페이지 틀 — 본문 폭 제한을 푸는 data-partners-landing(globals.css)을 소개와 같이 쓴다.
 * 시작 띠: 비회원은 그 페이지 쪽 가입 버튼 하나, 콜라보 회원은 대시보드, 다른 유형 회원은 회원 유형 바꾸기(창) — 옆에 다른 안내 페이지.
 */
export function AboutFrame({
  member,
  hero,
  role,
  bandTitle,
  sibling,
  children,
}: {
  member: boolean;
  hero: ReactNode;
  role: "advertiser" | "partner";
  bandTitle: string;
  sibling: { href: string; label: string };
  children: ReactNode;
}) {
  const { collabMember, otherMember, openCategory, modal } =
    useCollabStart(member);
  const top = useRef<HTMLDivElement>(null);
  return (
    <div ref={top} data-partners-landing="" className="flex flex-col">
      {hero}
      <div className={bodyClass(true)}>
        {children}
        <StartBand
          title={bandTitle}
          actions={
            <>
              <StartActions
                onPhoto={false}
                collabMember={collabMember}
                otherMember={otherMember}
                onChangeCategory={openCategory}
                only={role}
              />
              <CtaLink href={sibling.href} onPhoto={false}>
                {sibling.label}
              </CtaLink>
            </>
          }
        />
        <BackToTop target={top} />
      </div>
      {modal}
    </div>
  );
}

/**
 * 머리 — 소개 첫 화면을 낮춘 사진 띠(본문 폭 끝까지). 왼쪽 위 "← 콜라보 소개", 왼쪽 아래 칩 · 제목 · 한 줄.
 * 사진 위 글이 읽히게 아래 · 왼쪽으로 어둡게 덮는다(#000 고정 — black 토큰은 다크 모드에서 밝게 뒤집힌다).
 */
export function AboutHero({
  chip,
  title,
  lead,
  image,
}: {
  chip: string;
  title: string;
  lead: string;
  image: string;
}) {
  return (
    <section className="relative h-[380px] overflow-hidden bg-[#16131f] sm:h-[480px]">
      <ImageSlot
        src={image}
        sizes="100vw"
        priority
        className="absolute inset-0"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-[#000]/80 via-[#000]/40 to-[#000]/25"
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-linear-to-r from-[#000]/45 via-[#000]/10 to-transparent sm:block"
      />
      <div className="absolute inset-x-0 top-0 mx-auto max-w-[1120px] px-[24px] pt-[20px] sm:px-[40px] sm:pt-[32px]">
        <Link
          href="/partners"
          className="inline-flex items-center gap-[6px] text-[14px] font-semibold text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeftIcon className="size-[14px]" />
          콜라보 소개
        </Link>
      </div>
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1120px] px-[24px] pb-[44px] sm:px-[40px] sm:pb-[64px]">
        <span className="inline-block rounded-full bg-white/15 px-[12px] py-[4px] text-[13px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm">
          {chip}
        </span>
        <h1 className="mt-[16px] text-[34px] leading-[1.28] font-bold tracking-[-0.04em] break-keep text-white sm:text-[52px]">
          {title}
        </h1>
        <p className="mt-[12px] max-w-[560px] text-[15px] leading-[1.7] break-keep text-white/80 sm:mt-[16px] sm:text-[17px]">
          {lead}
        </p>
      </div>
    </section>
  );
}

/** 가운데 머리 — 보라 작은 머리 · 제목 · 설명(소개의 콜라보 구성 · 진행 방식과 같다). */
export function CenterHead({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className={H2}>{title}</h2>
      {lead && <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>{lead}</p>}
    </Reveal>
  );
}

/** 왼쪽 머리(PC는 따라 내려온다) + 오른쪽 내용 — 소개의 이용 방법과 같은 나눔. 휴대폰은 위아래. */
export function SplitSection({
  eyebrow,
  title,
  lead,
  aside,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-[36px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-[56px]">
      <Reveal className="lg:sticky lg:top-[40px] lg:self-start">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={H2}>{title}</h2>
        {lead && (
          <p className={cn(LEAD, "mt-[16px] max-w-[400px] sm:mt-[20px]")}>
            {lead}
          </p>
        )}
        {aside}
      </Reveal>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export type Step = { title: string; body: string; who?: Actor[] };

/** 순서 — 보라 번호 동그라미를 세로 선으로 잇고, 오른쪽에 제목 · 누가 하는지 · 설명. 하나씩 차례로 나타난다. */
export function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((s, i) => (
        <StepRow
          key={s.title}
          step={s}
          index={i}
          last={i === steps.length - 1}
        />
      ))}
    </ol>
  );
}

function StepRow({
  step: s,
  index: i,
  last,
}: {
  step: Step;
  index: number;
  last: boolean;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>(80);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn("flex gap-[16px] sm:gap-[24px]", reveal.className)}
    >
      <div className="flex flex-col items-center">
        <span className="flex size-[36px] shrink-0 items-center justify-center rounded-full bg-primary text-[14px] font-bold text-white sm:size-[40px] sm:text-[15px]">
          {i + 1}
        </span>
        {!last && (
          <span aria-hidden className="my-[6px] w-px flex-1 bg-gray-200" />
        )}
      </div>
      <div
        className={cn(
          "min-w-0 pt-[6px] sm:pt-[7px]",
          !last && "pb-[32px] sm:pb-[44px]",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-[10px] gap-y-[6px]">
          <h3 className="text-[18px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:text-[21px]">
            {s.title}
          </h3>
          {s.who && <ActorChips who={s.who} />}
        </div>
        <p className="mt-[8px] text-[14px] leading-[1.65] break-keep text-gray-500 sm:text-[15px]">
          {s.body}
        </p>
      </div>
    </li>
  );
}

/** 회색 카드 줄 — 카드마다 "N단계"(보라 작은 글) · 제목 · 설명. 휴대폰 한 칸, 그 위로 cols 칸. */
export function InfoCards({
  items,
  cols = 3,
  numbered = true,
}: {
  items: { title: string; body: string }[];
  cols?: 2 | 3;
  /** 카드 머리 "N단계" — 순서가 없는 묶음(알아 둘 것)은 끈다. */
  numbered?: boolean;
}) {
  return (
    <ul
      className={cn(
        "grid gap-[12px] sm:gap-[16px]",
        cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map((it, i) => (
        <InfoCard key={it.title} index={i} item={it} numbered={numbered} />
      ))}
    </ul>
  );
}

function InfoCard({
  item,
  index: i,
  numbered,
}: {
  item: { title: string; body: string };
  index: number;
  numbered: boolean;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 3) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col rounded-[24px] bg-gray-50 p-[24px] sm:p-[28px]",
        reveal.className,
      )}
    >
      {numbered && (
        <span className="mb-[14px] text-[13px] font-bold text-primary sm:mb-[20px] sm:text-[14px]">
          {i + 1}단계
        </span>
      )}
      <h3 className="text-[19px] leading-[1.4] font-bold tracking-[-0.02em] break-keep text-gray-900 sm:mt-[20px] sm:text-[21px]">
        {item.title}
      </h3>
      <p className="mt-[8px] text-[14px] leading-[1.65] break-keep text-gray-500 sm:text-[15px]">
        {item.body}
      </p>
    </li>
  );
}

/** 점선 테두리 한 줄 — 선택 사항 · 덧붙임(추가 기획 · 사업자등록증). 칩 · 제목 · 설명. */
export function NoteRow({
  chip,
  title,
  body,
}: {
  chip: string;
  title: string;
  body: string;
}) {
  return (
    <Reveal className="mt-[12px] flex flex-col gap-[8px] rounded-[24px] border border-dashed border-gray-300 px-[24px] py-[20px] sm:mt-[16px] sm:flex-row sm:items-center sm:gap-[16px] sm:px-[28px]">
      <span className="flex shrink-0 items-center gap-[8px]">
        <span className="rounded-full bg-gray-100 px-[8px] py-[2px] text-[12px] font-semibold text-gray-600">
          {chip}
        </span>
        <h3 className="text-[16px] font-bold text-gray-900 sm:text-[17px]">
          {title}
        </h3>
      </span>
      <p className="text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
        {body}
      </p>
    </Reveal>
  );
}
