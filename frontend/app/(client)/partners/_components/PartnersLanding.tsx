"use client";

import { Button } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import {
  COLLAB_SIGNUP_HREF,
  PARTNER_SIGNUP_HREF,
} from "@/app/(client)/(auth)/signup/_components/CategoryStep";
import { CategoryChangeModal } from "@/app/(client)/(mypage)/profile/_components/CategoryChangeModal";
import { MaskIcon } from "@/components/common/MaskIcon";
import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon } from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { canUsePartners } from "@/lib/memberCategory";
import {
  COLLAB_SCOPE_ITEMS,
  PARTNERS_DASHBOARD_HREF,
  type CollabScopeKey,
} from "@/lib/partners";
import { cn } from "@/lib/utils";

/*
 * /partners 소개 — 비회원 · 콜라보를 못 쓰는 회원(일반 · 대행사 · 매체사), ?intro=1 이면 누구나.
 * 11-17 사용자: "완전 다른 느낌으로, 다른 내용으로 고급지게" — 11-13 판(보라 빛 + 흰 카드 · 진행 방식 · 화면 미리 보기)을 통째로 바꿨다.
 *   잡지처럼 — 색은 회색조 + 보라는 점 하나만, 카드 대신 가는 선과 번호, 큰 제목은 Pretendard 세미볼드 + 좁은 자간.
 *   (처음엔 큰 제목을 콜라보 명조(HS활공명조)로 했다가 11-17 사용자 "글씨체가 너무 분위기가 확 바뀌었어"로 다른 화면과 같은 글꼴로 되돌림.
 *    명조는 첫 화면 맨 위 "Collaboration" 한 단어만 — 사이드바 로고 옆 글자와 같다.)
 *   위에서 아래로: 첫 화면(브랜드 ○ 매장 ○ 이 겹치는 그림) → 01 콜라보 구성(여섯 칸 타일) → 02 진행 방식(11-17 사용자 "기존에 있던 거" 되살림)
 *   → 03 admix가 맡는 일(흰 판 네 단계, 11-17 먹색 판에서 바꿈) → 04 브랜드 · 제휴사(가입 버튼) → 맨 위로.
 * 11-17 사용자: "광고주라고 되어 있는 거 전부 브랜드로", "제휴사 말고 다 매장으로" — 이 화면 글자는 브랜드 · 매장
 *   (코드 이름 advertiser · partner, 다른 화면의 광고주 · 제휴사는 그대로).
 * 11-17 사용자: "02 — 진행 방식 이런 거나 말투가 AI 티가 많이 나" — 번호 · 선 머리(01 —— 콜라보 구성 → 제목 위 보라 점 SectionDot), 첫 화면 "—— Collaboration",
 *   제목 끝 보라 점, 비유 제목("브랜드를 머물게", "브랜드의 자리가 돼요"), 화면을 설명하는 말("누가 맡는지 표시했어요"),
 *   짝 맞춘 문장("브랜드는 정하고, 매장은 고르면")을 뺐다. 제목은 하는 일을 그대로 말하고, 설명은 사실만 짧게.
 * 그대로 둔 것: 슬라이드 말고 스크롤(11-13), 밑에서 슥 올라오는 등장(useReveal, 11-13), 맨 아래 회색 "맨 위로"(11-13),
 *   첫 화면 버튼은 휴대폰도 좌우 나란히 작게(11-13), 회원 유형별 버튼(대시보드로 가기 · 회원 유형 바꾸기).
 * 문구는 지금 화면 · 의뢰서 · 기본협약에 있는 것만 옮겼다(금액 · 기간 · 매장 수 같은 숫자를 지어내지 않는다).
 */

/** 콜라보 가입 1단계에 유형을 골라 둔다 — 광고주 · 제휴사(콜라보) 모두 바로 회원가입으로(11-12 사용자). */
const ADVERTISER_SIGNUP_HREF = `${COLLAB_SIGNUP_HREF}&category=advertiser`;

/** 구역 제목 — 네 구역이 같은 크기. */
const H2 =
  "text-[28px] leading-[1.32] font-semibold tracking-[-0.03em] break-keep sm:text-[38px]";

/**
 * 01 — 콜라보 구성. 순서 · 이름 · 설명은 매장 "가능 범위"(COLLAB_SCOPE_ITEMS)와 같다 —
 * 11-17 사용자: "브랜딩 제작물(포스터, 소형 출력물) · 브랜드 굿즈 · 브랜딩 소모품 · DP 및 체험 · 협업 메뉴 · 공간 활용 순서로".
 * (그 전엔 의뢰서 이름 ITEM_LABEL — 브랜딩 홍보물 · 공간 연출 — 과 풀어 쓴 문장이었다.)
 * 아이콘은 항목마다 선 아이콘 하나(목록을 훑어보기 쉽게) — 11-17 사용자가 고른 public/icons 의 선 아이콘(1.5px 선 · 둥근 끝).
 *   커피 · 스티커는 같은 모양이 없어 같은 선 굵기 · 둥근 모서리로 새로 그렸다(stroke-coffee — 사용자 coffee.svg 를 다시 그림 · stroke-sticker).
 */
const FORMAT_ICON: Record<CollabScopeKey, string> = {
  print: "/icons/megaphone.svg",
  goods: "/icons/gift.svg",
  supplies: "/icons/stroke-sticker.svg",
  dp: "/icons/balloon.svg",
  menu: "/icons/stroke-coffee.svg",
  space: "/icons/stroke-store.svg",
};

/**
 * 02 — 진행 방식. 단계마다 누가 하는지(브랜드 · admix · 매장) 칩으로.
 * 11-13 판에 있던 여섯 단계를 11-17 사용자 "콜라보 진행 방식 내용 추가(기존에 있던 거)"로 되살렸다 — 글은 그대로, 광고주만 브랜드로.
 */
type Actor = "brand" | "admix" | "partner";
const FLOW: { title: string; who: Actor[]; body: string }[] = [
  {
    title: "의뢰",
    who: ["brand"],
    body: "구성 · 기간 · 원하는 매장을 담아 의뢰해요.",
  },
  {
    title: "기획안",
    who: ["admix"],
    body: "admix가 기획안을 보내고, 브랜드가 확인하면 확정돼요.",
  },
  {
    title: "매장 모집",
    who: ["partner"],
    body: "매장이 선착순으로 참여를 신청해요.",
  },
  {
    title: "매장 확정",
    who: ["brand", "partner"],
    body: "브랜드가 살펴본 뒤 매장이 최종 확정해요.",
  },
  {
    title: "진행",
    who: ["admix", "partner"],
    body: "준비 · 설치를 마치면 시작하고, 중간 보고로 상황을 알려요.",
  },
  {
    title: "결과 보고",
    who: ["admix"],
    body: "철수 후 결과 보고서를 전달해요.",
  },
];

/** 진행 방식 칩 — 누가 하는지 한눈에 갈리게 아주 옅은 색만(브랜드 보라 · 매장 노랑 · admix 회색, 11-13 판과 같은 짝). */
const ACTOR: Record<Actor, { label: string; className: string }> = {
  brand: {
    label: "브랜드",
    className:
      "bg-primary-200/70 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
  },
  partner: {
    label: "매장",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  admix: { label: "admix", className: "bg-gray-100 text-gray-700" },
};

/**
 * 03 — admix가 맡는 일, 진행 순서대로 한 문장씩(11-17 사용자: "심플하게, 한 번에 이해되게"). 보고서 이름은 진행 화면(REPORT_LABEL)과 같다.
 * 둘째 칸은 기획안 → 운영 관리(11-17 사용자: "운영 관련해서 어필할 수 있는 내용" — 기획안은 바로 위 진행 방식에 있다).
 */
// 운영 관리는 "문제를 대신 처리해요"처럼 책임을 떠맡는 말은 쓰지 않는다(11-17 사용자).
const ADMIX_PART: { title: string; body: string }[] = [
  {
    title: "매장 확인",
    body: "admix가 직접 확인한 매장만 사진과 정보를 올려요.",
  },
  {
    title: "운영 관리",
    body: "매장과 일정을 맞추고, 진행 상황을 꾸준히 확인해요.",
  },
  {
    title: "제작 · 설치 · 철수",
    body: "제작을 맡기면 만들어서 설치하고, 끝나면 철수해요.",
  },
  {
    title: "보고서",
    body: "설치했을 때, 진행 중간, 끝난 뒤에 보고서를 보내 드려요.",
  },
];

/**
 * 04 — 브랜드(광고주 회원) · 제휴사가 각각 무엇을 하는지. 가입 버튼은 비회원에게만(회원은 첫 화면 버튼으로 충분하다).
 * 11-17 사용자: "너무 추상적으로 말고 직관적으로, 간결하게" — 머리는 영어(For brands) 대신 회원 유형 이름, 제목은 하는 일 그대로.
 */
const AUDIENCES: {
  id: "advertiser" | "partner";
  label: string;
  title: [string, string];
  points: string[];
  cta: { label: string; href: string };
}[] = [
  {
    id: "advertiser",
    label: "브랜드",
    title: ["매장을 골라", "콜라보를 의뢰해요"],
    points: [
      "매장 사진과 금액을 보고 골라요.",
      "마음에 드는 매장은 관심 매장에 담아요.",
      "의뢰 내용과 진행 상황, 보고서를 한 화면에서 봐요.",
    ],
    cta: { label: "브랜드로 시작하기", href: ADVERTISER_SIGNUP_HREF },
  },
  {
    id: "partner",
    label: "매장",
    title: ["매장 공간으로", "콜라보에 참여해요"],
    points: [
      "등록비 · 이용료가 없어요.",
      "콜라보마다 참여할지 직접 골라요.",
      "설치 · 철수는 admix가 해요.",
    ],
    cta: { label: "매장으로 시작하기", href: PARTNER_SIGNUP_HREF },
  },
];

export function PartnersLanding({ member = false }: { member?: boolean }) {
  const { data: me } = useMe();
  // 광고주 · 제휴사가 ?intro=1 로 보면 가입 대신 대시보드로, 다른 유형 회원은 회원 유형 바꾸기로.
  const collabMember = canUsePartners(me?.member_category);
  const otherMember = (member || !!me) && !collabMember;
  const top = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={top}
      // data-partners-landing — 본문(main)이 이 화면일 때만 배경 그라데이션을 깐다(globals.css, 11-17 사용자: "배경이 너무 밋밋").
      data-partners-landing=""
      className="flex flex-col gap-[96px] pb-[24px] sm:gap-[160px] sm:pb-[40px]"
    >
      <Hero collabMember={collabMember} otherMember={otherMember} />
      {/* 히어로 아래 섹션끼리는 더 띄운다(11-17 사용자: "아래 내용들은 서로 붙어 있는데 간격을 떨어트려줘") — 96 · 160 → 144 · 240. */}
      <div className="flex flex-col gap-[144px] sm:gap-[240px]">
        <Formats />
        <Flow />
        <AdmixPart />
        <Audiences join={!collabMember && !otherMember} />
      </div>
      <BackToTop target={top} />
    </div>
  );
}

/* ── 첫 화면 ─────────────────────────────────────────────────────────── */

function Hero({
  collabMember,
  otherMember,
}: {
  collabMember: boolean;
  otherMember: boolean;
}) {
  const { data: me } = useMe();
  // 회원 유형 바꾸기 창(내 정보와 같은 창) — 11-17 사용자: "누르면 유형 바꾸는 팝업이 뜨게, 페이지 이동 말고".
  // 광고주 · 제휴사로 바꾸면 내 정보를 다시 받아 PartnersHome 이 대시보드로 옮겨 준다.
  const [categoryOpen, setCategoryOpen] = useState(false);
  return (
    // PC는 첫 화면을 꽉 채운다(본문 위아래 여백 64px을 뺀 높이) — 01은 스크롤해야 보이고, 맨 아래 가는 선이 내려 보라고 알린다.
    <section className="relative grid items-center gap-[48px] pt-[12px] sm:pt-[40px] lg:min-h-[calc(100dvh-64px)] lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-[40px] lg:pt-0 lg:pb-[56px]">
      <ScrollCue />
      {/* 11-17 사용자: "말을 줄여 달라" — 설명은 두고 문장만 짧게(한때 설명까지 다 뺐다가 "설명을 다 빼랬냐"로 되살림). */}
      <div className="min-w-0">
        <h1 className="text-[34px] leading-[1.26] font-semibold tracking-[-0.04em] break-keep text-gray-900 sm:text-[48px] xl:text-[56px]">
          브랜드와 매장의
          <br />
          콜라보를 연결해요
        </h1>
        <p className="mt-[18px] max-w-[420px] text-[15px] leading-[1.75] break-keep text-gray-500 sm:mt-[28px] sm:text-[17px]">
          브랜드는 매장을 골라 의뢰하고, 매장은 원하는 콜라보에 참여해요.
        </p>
        {/* 휴대폰도 좌우 나란히, 작게(11-13 사용자). */}
        <div className="mt-[28px] flex flex-row flex-wrap items-center gap-[8px] sm:mt-[40px] sm:gap-[10px]">
          {collabMember ? (
            <CtaLink href={PARTNERS_DASHBOARD_HREF} solid>
              대시보드로 가기
            </CtaLink>
          ) : otherMember ? (
            <button
              type="button"
              onClick={() => setCategoryOpen(true)}
              className={ctaClass(true)}
            >
              회원 유형 바꾸기
              <CtaArrow />
            </button>
          ) : (
            <>
              <CtaLink href={ADVERTISER_SIGNUP_HREF} solid>
                브랜드로 시작하기
              </CtaLink>
              <CtaLink href={PARTNER_SIGNUP_HREF}>매장으로 시작하기</CtaLink>
            </>
          )}
        </div>
        {otherMember && (
          <p className="mt-[14px] max-w-[420px] text-[13px] leading-[1.6] break-keep text-gray-500">
            콜라보는 브랜드 · 매장 회원만 쓸 수 있어요.
          </p>
        )}
      </div>
      <BrandStoreMark />
      <CategoryChangeModal
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        current={me?.member_category}
      />
    </section>
  );
}

/**
 * 첫 화면 그림 — 브랜드 ○ 와 매장 ○ 이 겹친 자리(렌즈)에 admix 글자 로고.
 * 11-17 사용자: "ScrollMouseIcon이랑 비슷한 디자인으로" → 마우스 아이콘과 같은 #888 반투명 면 + 같은 색 테두리, 이어서 "좀 더 예쁘게" →
 *   면은 위가 옅고 아래가 조금 짙은 회색(빛이 위에서 오는 듯), 테두리는 가늘게, 겹친 자리는 반투명 흰 유리 렌즈 + 옅은 그림자로
 *   띄워 admix 로고가 또렷하게, 두 원이 만나는 위아래 점에 작은 점. 보라 · 심볼 색은 쓰지 않는다(심볼 색은 "화려하다"로 되돌림).
 * 처음 열 때 두 원이 양옆에서 천천히 다가와 겹치고 → 렌즈가 떠오르고 → 로고가 뜬다(움직임 줄이기 설정이면 바로 그 자리).
 */
const MARK_GRAY = "#888888";
/** 두 원(반지름 124, 가운데 160 · 280)이 만나는 위아래 점 — x 220, y 160 ∓ √(124² − 60²). */
const LENS_TOP = 160 - Math.sqrt(124 ** 2 - 60 ** 2);
const LENS_BOTTOM = 160 + Math.sqrt(124 ** 2 - 60 ** 2);
const LENS_PATH = `M220 ${LENS_TOP} A124 124 0 0 1 220 ${LENS_BOTTOM} A124 124 0 0 1 220 ${LENS_TOP} Z`;

function BrandStoreMark() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const move =
    "transition-[translate,opacity] duration-[1600ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";
  const late = (delay: string) =>
    cn(
      "transition-opacity duration-[900ms] motion-reduce:transition-none",
      delay,
      on ? "opacity-100" : "opacity-0",
    );
  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-[320px] sm:max-w-[440px] lg:max-w-none"
    >
      <svg viewBox="0 0 440 320" className="w-full overflow-visible">
        <defs>
          <linearGradient id="partners-mark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={MARK_GRAY} stopOpacity="0.06" />
            <stop offset="1" stopColor={MARK_GRAY} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {(
          [
            {
              cx: 160,
              label: "Brand",
              labelX: 96,
              from: "-translate-x-[40px]",
            },
            {
              cx: 280,
              label: "Store",
              labelX: 344,
              from: "translate-x-[40px]",
            },
          ] as const
        ).map((c) => (
          <g
            key={c.label}
            className={cn(
              move,
              on ? "translate-x-0 opacity-100" : cn(c.from, "opacity-0"),
            )}
          >
            <circle
              cx={c.cx}
              cy="160"
              r="124"
              fill="url(#partners-mark-fill)"
              stroke={MARK_GRAY}
              strokeOpacity="0.7"
              strokeWidth="1.5"
            />
            <text
              x={c.labelX}
              y="160"
              textAnchor="middle"
              dominantBaseline="central"
              fill={MARK_GRAY}
              className="text-[15px] font-semibold tracking-[0.02em]"
            >
              {c.label}
            </text>
          </g>
        ))}
        {/* 겹친 자리 — 반투명 흰 유리 렌즈. 두 원이 다 다가온 뒤에 떠오른다. */}
        <path
          d={LENS_PATH}
          className={cn(
            "fill-surface/70 stroke-surface drop-shadow-[0_10px_18px_rgba(17,12,46,0.10)] dark:fill-white/[0.08] dark:stroke-white/20",
            late("delay-[900ms]"),
          )}
          strokeWidth="1.5"
        />
        <g className={late("delay-[1000ms]")}>
          <circle cx="220" cy={LENS_TOP} r="3.5" fill={MARK_GRAY} />
          <circle cx="220" cy={LENS_BOTTOM} r="3.5" fill={MARK_GRAY} />
        </g>
      </svg>
      <Image
        src="/service/admix-text-logo.svg"
        alt=""
        width={78}
        height={22}
        className={cn(
          "absolute top-1/2 left-1/2 h-[16px] w-auto -translate-x-1/2 -translate-y-1/2 sm:h-[20px] dark:brightness-0 dark:invert",
          late("delay-[1200ms]"),
        )}
      />
    </div>
  );
}

/**
 * 첫 화면 맨 아래 가운데 스크롤 표시 — 아래 화살표가 천천히 살짝 내려갔다 올라온다(PC만, 움직임 줄이기면 멈춤).
 * "Scroll" 글자 + 가는 세로 선 → 마우스 아이콘(ScrollMouseIcon) → 11-17 사용자 "아래 화살표 아이콘으로 할까?"로 화살표.
 */
function ScrollCue() {
  return (
    <span
      aria-hidden
      className="absolute bottom-0 left-1/2 hidden -translate-x-1/2 text-gray-400 lg:flex"
    >
      <ArrowDownIcon className="size-[24px] animate-[partners-landing-cue_2.4s_ease-in-out_infinite] motion-reduce:animate-none" />
    </span>
  );
}

/* ── 01 콜라보 구성 ──────────────────────────────────────────────────── */

/**
 * PC는 왼쪽 제목이 따라 내려오고(sticky) 오른쪽에 여섯 칸 타일(두 칸 × 세 줄 — 세 칸이면 좁아 설명이 큰 번호와 겹친다), 휴대폰은 한 칸.
 * 11-17 사용자: 글은 "최대한 줄여" · "SNS 인증 이벤트 · 현장 인력" 한 줄은 "없애줘", 목록은 "더 예쁘게"(두 번) —
 *   큰 글자 여섯 줄 → 아이콘 타일 → 배경 빛이 비치는 반투명 유리 타일 + 보라 아이콘 칸.
 *   (큰 옅은 번호도 달았다가 순서가 없는 목록이라 뺐다 — "AI 티", 11-17.)
 */
function Formats() {
  return (
    <section className="grid gap-[32px] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-[64px]">
      <Reveal className="lg:sticky lg:top-[40px] lg:self-start">
        <SectionDot />
        <h2 className={cn(H2, "text-gray-900")}>
          이런 콜라보를
          <br />할 수 있어요
        </h2>
        <p className="mt-[16px] max-w-[380px] text-[15px] leading-[1.75] break-keep text-gray-500 sm:mt-[20px] sm:text-[16px]">
          의뢰서에서 원하는 구성을 골라 담으면 돼요.
        </p>
      </Reveal>
      <ol className="grid gap-[10px] sm:grid-cols-2 sm:gap-[12px]">
        {COLLAB_SCOPE_ITEMS.map((item, i) => (
          <FormatTile key={item.key} item={item} index={i} />
        ))}
      </ol>
    </section>
  );
}

function FormatTile({
  item,
  index: i,
}: {
  item: (typeof COLLAB_SCOPE_ITEMS)[number];
  index: number;
}) {
  // 한꺼번에 보이는 칸은 차례로, 늦게 들어오는 칸은 너무 기다리지 않게(최대 270ms).
  const [revealRef, reveal] = useReveal<HTMLLIElement>(Math.min(i, 3) * 90);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        // 반투명 흰 유리 — 소개 배경 빛이 은은하게 비친다. 휴대폰은 아이콘 옆에 글(한 칸씩 위아래로 길어지지 않게).
        // 태블릿 · PC는 위에 연보라 판 + 큰 아이콘, 아래에 글(11-17 사용자: 아이콘과 글 사이가 비어 "너무 허전").
        "relative grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-[14px] overflow-hidden rounded-[20px] bg-surface/75 p-[16px] shadow-[0_10px_30px_-12px_rgba(17,12,46,0.12)] ring-1 ring-white/80 backdrop-blur-md sm:flex sm:flex-col sm:items-stretch sm:rounded-[24px] sm:p-[10px] dark:bg-surface/60 dark:ring-white/[0.06]",
        reveal.className,
      )}
    >
      <span className="flex size-[44px] items-center justify-center rounded-[14px] bg-primary-50 text-primary-400 sm:h-[80px] sm:w-full sm:rounded-[16px] sm:bg-linear-to-b sm:from-primary-50 sm:to-primary-100/80 dark:bg-primary-500/15 dark:text-primary-300 sm:dark:bg-transparent sm:dark:from-primary-500/12 sm:dark:to-primary-500/[0.04]">
        <MaskIcon
          src={FORMAT_ICON[item.key]}
          className="size-[22px] sm:size-[28px]"
        />
      </span>
      {/* 제목이 아이콘보다 먼저 읽히게 — 아이콘은 작고 옅게, 제목은 한 단계 크게(11-17 사용자: "아이콘보다 제목이 더 잘 보였으면"). */}
      <div className="relative min-w-0 sm:px-[12px] sm:pt-[18px] sm:pb-[14px]">
        <h3 className="text-[17px] leading-[1.4] font-semibold tracking-[-0.02em] text-gray-900 sm:text-[20px]">
          {item.label}
        </h3>
        <p className="mt-[2px] text-[13px] leading-[1.55] break-keep text-gray-500 sm:mt-[4px] sm:text-[14px]">
          {item.desc}
        </p>
      </div>
    </li>
  );
}

/* ── 02 진행 방식 ────────────────────────────────────────────────────── */

/**
 * 카드 없이 가는 윗선 + 번호로 여섯 단계(PC 세 칸 × 두 줄, 태블릿 두 칸, 휴대폰 한 칸) — 01 타일 · 03 흰 판과 다르게 잡지 표처럼.
 * 윗선 앞머리만 짧게 진한 선으로 눌러 순서가 읽히게 한다.
 */
function Flow() {
  return (
    <section>
      <Reveal>
        <SectionDot />
        <h2 className={cn(H2, "text-gray-900")}>콜라보는 이렇게 진행돼요</h2>
      </Reveal>
      <ol className="mt-[36px] grid gap-x-[28px] gap-y-[28px] sm:mt-[56px] sm:grid-cols-2 sm:gap-y-[44px] lg:grid-cols-3 lg:gap-x-[40px]">
        {FLOW.map((step, i) => (
          <FlowStep key={step.title} step={step} index={i} />
        ))}
      </ol>
    </section>
  );
}

function FlowStep({
  step: s,
  index: i,
}: {
  step: (typeof FLOW)[number];
  index: number;
}) {
  // 한 줄(PC 세 칸)씩 차례로 올라온다.
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 3) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "relative border-t border-gray-200 pt-[18px] sm:pt-[22px]",
        reveal.className,
      )}
    >
      <span
        aria-hidden
        className="absolute -top-px left-0 h-[2px] w-[28px] bg-gray-900"
      />
      <div className="flex items-center justify-between gap-[12px]">
        <span className="text-[13px] font-medium text-gray-400 sm:text-[14px]">
          {i + 1}단계
        </span>
        <span className="flex gap-[4px]">
          {s.who.map((a) => (
            <span
              key={a}
              className={cn(
                "rounded-full px-[8px] py-[2px] text-[12px] font-semibold whitespace-nowrap",
                ACTOR[a].className,
              )}
            >
              {ACTOR[a].label}
            </span>
          ))}
        </span>
      </div>
      <h3 className="mt-[12px] text-[17px] leading-[1.4] font-semibold tracking-[-0.02em] text-gray-900 sm:mt-[16px] sm:text-[19px]">
        {s.title}
      </h3>
      <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
        {s.body}
      </p>
    </li>
  );
}

/* ── 03 admix가 맡는 일 ──────────────────────────────────────────────── */

/**
 * 흰 판 위에 네 단계 흐름 — 번호 동그라미를 가는 선으로 잇는다(PC 한 줄 네 칸, 태블릿 두 칸, 휴대폰은 위아래 + 왼쪽 세로 선).
 * 11-17 사용자: 먹색 판은 "갑자기 검정이 나오니까 이상해", 내용은 "심플하게 줄이되 한 번에 이해되게" → 판을 01 타일과 같은 흰색으로,
 *   단계마다 제목 + 한 문장.
 */
function AdmixPart() {
  return (
    <Reveal>
      {/* 반투명 흰 판 + 흰 테두리 — 배경 빛이 은은하게 비친다(11-17 사용자: "배경에 투명도를 주고 테두리를 흰색으로", 01 카드와 같은 유리 느낌). */}
      <section className="rounded-[28px] bg-surface/60 px-[24px] py-[40px] shadow-[0_10px_30px_-12px_rgba(17,12,46,0.10)] ring-1 ring-white backdrop-blur-md sm:rounded-[32px] sm:px-[48px] sm:py-[64px] lg:px-[56px] dark:bg-surface/50 dark:ring-white/[0.08]">
        <SectionDot />
        <h2 className={cn(H2, "text-gray-900")}>이런 일은 admix가 해요</h2>
        <p className="mt-[16px] max-w-[440px] text-[15px] leading-[1.75] break-keep text-gray-500 sm:mt-[20px] sm:text-[16px]">
          콜라보에 필요한 준비와 관리는 admix가 해요.
        </p>
        <ol className="mt-[36px] grid gap-y-[28px] sm:mt-[56px] sm:grid-cols-2 sm:gap-x-[28px] sm:gap-y-[40px] lg:grid-cols-4 lg:gap-x-0">
          {ADMIX_PART.map((p, i) => (
            <AdmixPartItem
              key={p.title}
              part={p}
              index={i}
              last={i === ADMIX_PART.length - 1}
            />
          ))}
        </ol>
      </section>
    </Reveal>
  );
}

function AdmixPartItem({
  part: p,
  index: i,
  last,
}: {
  part: (typeof ADMIX_PART)[number];
  index: number;
  last: boolean;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>(300 + i * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        // 휴대폰: 왼쪽 번호 + 오른쪽 글, 번호 사이를 세로 선으로. PC: 위 번호 + 가로 선, 아래 글.
        "relative grid grid-cols-[32px_minmax(0,1fr)] gap-x-[14px] sm:block lg:pr-[24px]",
        reveal.className,
      )}
    >
      {!last && (
        <span
          aria-hidden
          className="absolute top-[40px] -bottom-[24px] left-[15.5px] w-px bg-gray-200 sm:hidden"
        />
      )}
      <div className="flex items-center gap-[12px]">
        <span className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-gray-900 text-[13px] font-semibold text-surface">
          {i + 1}
        </span>
        {!last && (
          <span
            aria-hidden
            className="hidden h-px flex-1 bg-gray-200 lg:block"
          />
        )}
      </div>
      <div className="min-w-0 sm:mt-[18px]">
        <h3 className="pt-[4px] text-[17px] leading-[1.4] font-semibold tracking-[-0.02em] text-gray-900 sm:pt-0 sm:text-[19px]">
          {p.title}
        </h3>
        <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
          {p.body}
        </p>
      </div>
    </li>
  );
}

/* ── 04 브랜드 · 매장 ────────────────────────────────────────────────── */

/** 카드 없이 가는 선으로 둘을 나눈다 — PC는 좌우(가운데 세로 선), 좁으면 위아래. */
function Audiences({ join }: { join: boolean }) {
  return (
    <section>
      <Reveal>
        <SectionDot />
        <h2 className={cn(H2, "text-gray-900")}>
          브랜드와 매장은 이렇게 이용해요
        </h2>
      </Reveal>
      <div className="mt-[28px] grid border-t border-gray-200 sm:mt-[40px] lg:grid-cols-2">
        {AUDIENCES.map((a, i) => (
          <AudienceColumn key={a.id} audience={a} index={i} join={join} />
        ))}
      </div>
    </section>
  );
}

function AudienceColumn({
  audience: a,
  index: i,
  join,
}: {
  audience: (typeof AUDIENCES)[number];
  index: number;
  join: boolean;
}) {
  const [revealRef, reveal] = useReveal<HTMLElement>(i * 140);
  return (
    <article
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex flex-col py-[36px] sm:py-[48px] max-lg:not-first:border-t max-lg:not-first:border-gray-200 lg:pr-[48px] lg:not-first:border-l lg:not-first:border-gray-200 lg:not-first:pr-0 lg:not-first:pl-[48px]",
        reveal.className,
      )}
    >
      <span className="w-fit rounded-full bg-gray-100 px-[10px] py-[3px] text-[13px] font-semibold text-gray-600 sm:text-[14px]">
        {a.label}
      </span>
      <h3 className="mt-[14px] text-[24px] leading-[1.36] font-semibold tracking-[-0.03em] break-keep text-gray-900 sm:text-[30px]">
        {a.title[0]}
        <br />
        {a.title[1]}
      </h3>
      <ul className="mt-[24px] flex flex-col gap-[10px] sm:mt-[28px]">
        {a.points.map((p) => (
          <li
            key={p}
            className="flex gap-[12px] text-[14px] leading-[1.65] break-keep text-gray-600 sm:text-[15px]"
          >
            <span
              aria-hidden
              className="mt-[11px] h-px w-[12px] shrink-0 bg-gray-400"
            />
            {p}
          </li>
        ))}
      </ul>
      {/* 첫 화면 버튼과 같은 모양(11-17 사용자) — 브랜드는 진한 버튼, 매장은 테두리 버튼. */}
      {join && (
        <div className="mt-[32px] sm:mt-[40px]">
          <CtaLink href={a.cta.href} solid={a.id === "advertiser"}>
            {a.cta.label}
          </CtaLink>
        </div>
      )}
    </article>
  );
}

/* ── 공용 ────────────────────────────────────────────────────────────── */

/**
 * 구역 제목 위 작은 보라 점 — 11-17 사용자: "01 이런 거 말고 보라색 점? 이런 걸로" (번호 · 선 머리는 "AI 티"로 뺐다).
 * 네 구역 제목 위에만, 글자 없이 점 하나.
 */
function SectionDot() {
  return (
    <span
      aria-hidden
      className="mb-[16px] block size-[8px] rounded-full bg-primary sm:mb-[20px] sm:size-[10px]"
    />
  );
}

/** 첫 화면 버튼 — solid: 먹색(마우스를 올리면 보라, 11-12 사용자), 아니면 가는 테두리. */
function CtaLink({
  href,
  solid = false,
  children,
}: {
  href: string;
  solid?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={ctaClass(solid)}>
      {children}
      <CtaArrow />
    </Link>
  );
}

/** 첫 화면 버튼 모양 — 링크(CtaLink)와 창을 여는 버튼(회원 유형 바꾸기)이 같이 쓴다. */
function ctaClass(solid: boolean) {
  return cn(
    "group inline-flex h-[42px] cursor-pointer items-center gap-[6px] rounded-full px-[16px] text-[13px] font-semibold whitespace-nowrap transition-colors sm:h-[52px] sm:px-[26px] sm:text-[15px]",
    solid
      ? "bg-gray-900 text-surface hover:bg-primary hover:text-white"
      : "border border-gray-300 text-gray-900 hover:border-gray-900",
  );
}

function CtaArrow() {
  return (
    <ArrowLeftIcon className="size-[14px] rotate-180 transition-transform group-hover:translate-x-[2px] sm:size-[16px]" />
  );
}

/**
 * 맨 위로 — 이 화면은 창이 아니라 본문(main)이 스크롤되므로, 소개를 감싼 칸에서 위로 올라가며 스크롤되는 상자를 찾아 올린다
 * (없으면 창). 색은 남색 기운의 진한 회색(11-13 사용자: "회색이나 남색으로") — admix 매체 찾기 "맨 위로" · 믹시 "맨 아래로"와 같은
 * bg-gray-800/90 + text-surface(다크 모드는 밝은 회색 바탕 · 어두운 글자로 뒤집힌다), 마우스를 올리면 gray-900.
 */
function BackToTop({ target }: { target: RefObject<HTMLElement | null> }) {
  const goTop = () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    let el = target.current?.parentElement ?? null;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (
        /(auto|scroll)/.test(overflowY) &&
        el.scrollHeight > el.clientHeight
      ) {
        el.scrollTo({ top: 0, behavior });
        return;
      }
      el = el.parentElement;
    }
    window.scrollTo({ top: 0, behavior });
  };
  return (
    <Reveal className="-mt-[48px] flex justify-center sm:-mt-[96px]">
      <Button
        variant="ghost"
        onPress={goTop}
        className="h-[44px] gap-[6px] rounded-full bg-gray-800/90 px-[20px] text-[14px] font-semibold text-surface shadow-[0_4px_12px_rgba(0,0,0,0.18)] backdrop-blur transition-colors data-[hovered=true]:bg-gray-900"
      >
        <ArrowUpIcon className="size-[16px]" />맨 위로
      </Button>
    </Reveal>
  );
}

/** 스크롤 등장 — 처음엔 32px 아래 · 투명, 화면에 들어오면 0.9초 동안 제자리로. */
const REVEAL_BASE =
  "transition-[opacity,translate] duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none";

/**
 * 스크롤해 화면에 들어오면 밑에서 슥 올라오며 나타나게(11-13 사용자: "스크롤 내릴 때 하나씩 … 밑에서 슥 올라오는 것처럼").
 * 15%쯤 보이면 시작하고, 한 번 나타나면 그대로 둔다(위로 다시 올려도 숨기지 않는다).
 * delay(ms): 같은 줄에 나란한 것들을 하나씩 차례로. 움직임 줄이기 설정이면 움직이지 않고 처음부터 보인다.
 * 이 화면은 창이 아니라 main 이 스크롤되지만, 관찰 기준을 화면(root 없음)으로 두면 스크롤 상자에 가려진 부분도 알아서 빠진다.
 */
function useReveal<T extends HTMLElement>(delay = 0) {
  // 요소는 콜백 ref 로 받는다 — 렌더 중에 ref 객체를 넘기지 않게(react-hooks/refs).
  const [el, ref] = useState<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        // 화면에 들어올 때만. 한 번에 건너뛴 것은 다시 올라가 볼 때 그 자리에서 올라온다.
        if (!entries.some((e) => e.isIntersecting)) return;
        setShown(true);
        io.disconnect();
      },
      // 화면 아래 끝 여백(rootMargin)은 두지 않는다 — 맨 아래 "맨 위로"처럼 더 내릴 수 없는 것도 나타나게.
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  // 기다림은 나타날 때만 — 처음 숨길 때 기다리면 깜빡 보였다 사라진다.
  const style: CSSProperties | undefined =
    shown && delay ? { transitionDelay: `${delay}ms` } : undefined;
  const className = cn(
    REVEAL_BASE,
    shown ? "translate-y-0 opacity-100" : "translate-y-[32px] opacity-0",
  );
  // [요소에 붙일 콜백 ref, 그 요소의 style · className]
  return [ref, { style, className }] as const;
}

function Reveal({
  delay,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(delay);
  return (
    <div
      ref={revealRef}
      style={reveal.style}
      className={cn(reveal.className, className)}
    >
      {children}
    </div>
  );
}
