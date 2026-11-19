"use client";

import { Button } from "@heroui/react";
import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
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
import {
  ArrowLeftIcon,
  ArrowUpIcon,
  ChevronDoubleDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ScrollMouseIcon,
} from "@/components/icons";
import { useMe } from "@/hooks/auth";
import { canUsePartners } from "@/lib/memberCategory";
import { COLLAB_SCOPE_ITEMS, PARTNERS_DASHBOARD_HREF } from "@/lib/partners";
import { cn } from "@/lib/utils";

/*
 * 말투(11-19 사용자: "말투가 요체인데 담백하게") — 이 화면만 해요체를 쓰지 않는다. 제목은 명사로 맺고(레퍼런스처럼),
 *   설명 · 카드 글은 합니다체 짧은 문장. 버튼 이름(…로 시작하기 · 대시보드로 가기)은 그대로.
 * /partners 소개 — 비회원 · 콜라보를 못 쓰는 회원(일반 · 대행사 · 매체사), ?intro=1 이면 누구나.
 * 11-19 사용자: 레퍼런스 세 장(전자서명 서비스 · 다크 세계관 소개 · 세무회계 랜딩)에 맞춰 다시 — 11-17 잡지형(회색조 · 가는 선)을 통째로 바꿨다.
 *   위에서 아래로:
 *   첫 화면 — 넓은 흑백 사진 칸 위 왼쪽 아래에 제목 · 버튼만(11-19 넷째 레퍼런스로 보라 판 히어로를 바꾼 뒤, 사용자: 더 간단하게 · 사진 위로 · 말풍선 빼기)
 *   → 소개 — 가운데 작은 보라 머리 · 제목 · 점선(다크 Overview) → 브랜드 · admix · 매장 사진 세 칸(다크 Background)
 *   → 콜라보 구성 — 크고 작은 회색 카드 묶음(세무 핵심 서비스) → 진행 방식 — 단계 카드 두 칸(세무 업무 절차)
 *   → admix 운영 — 왼쪽 글 + 오른쪽 가로로 넘기는 카드, 첫 장만 보라(전자서명 보안)
 *   → 이용 방법 — 왼쪽 글 + 엇갈린 두 줄 카드(전자서명 계약서 양식) → 보라 띠 시작 버튼(전자서명 자료 받기 띠) → 맨 위로.
 *   이미지 칸(ImageSlot)은 처음엔 회색으로 비웠다가(11-19 사용자: "나중에 이미지 찾아서 넣을 테니까") 같은 날 "샘플 이미지들을 넣어 줄 수 있어?"로
 *   무료 사진(Pexels 라이선스 — 상업적 사용 · 출처 표시 없이 가능)을 public/images/partners-landing 에 받아 넣었다. 실제 사진을 고르면 같은 이름으로 바꿔 끼우면 된다.
 * 그대로 지킨 것(11-17): 이 화면 글자는 브랜드 · 매장(코드 이름 advertiser · partner), 번호+선 머리 · 비유 제목 · 메타 문구 같은 "AI 티" 금지,
 *   운영 문구에 "문제를 대신 처리" 금지, 숫자는 지어내지 않는다(레퍼런스의 통계 · 후기 칸은 쓰지 않았다),
 *   밑에서 슥 올라오는 등장(useReveal), 맨 아래 회색 "맨 위로", 회원 유형별 버튼(대시보드로 가기 · 회원 유형 바꾸기 창).
 */

/** 콜라보 가입 1단계에 유형을 골라 둔다 — 광고주 · 제휴사(콜라보) 모두 바로 회원가입으로(11-12 사용자). */
const ADVERTISER_SIGNUP_HREF = `${COLLAB_SIGNUP_HREF}&category=advertiser`;

/**
 * 샘플 사진(11-19) — public/images/partners-landing/{이름}.jpg. Pexels 사진 번호(바꿀 때 참고):
 * role-brand 34939732 · role-admix 7550298 · role-store 8662149 ·
 * format-print 11696469 · goods 8148587 · supplies 7319334 · dp 3735630 · menu 2068296 · space 31168538 ·
 * flow-1 7793988 · 2 6476254 · 3 40168907 · 4 31353701 · 5 13131123 · 6 3183186.
 */
const sample = (name: string) => `/images/partners-landing/${name}.jpg`;

/** 구역 제목 — 모든 구역이 같은 크기. */
const H2 =
  "text-[28px] leading-[1.32] font-bold tracking-[-0.03em] break-keep text-gray-900 sm:text-[38px]";
/** 구역 설명. */
const LEAD =
  "text-[15px] leading-[1.75] break-keep text-gray-500 sm:text-[16px]";

/** 소개 사진 세 칸 — 누가 무엇을 하는지(브랜드 · admix · 매장). 글은 지금 화면 · 협약서에 있는 사실만. */
const ROLES: {
  chip: string;
  image: string;
  title: [string, string];
  note: string;
}[] = [
  {
    chip: "브랜드",
    image: sample("role-brand"),
    title: ["직접 고른 매장에", "콜라보 의뢰"],
    note: "매장 사진과 금액을 보고 고릅니다.",
  },
  {
    chip: "admix",
    image: sample("role-admix"),
    title: ["준비부터 관리까지", "admix가 담당"],
    note: "제작 · 설치 · 철수와 보고서를 맡습니다.",
  },
  {
    chip: "매장",
    image: sample("role-store"),
    title: ["매장 공간으로", "콜라보 참여"],
    note: "등록비 · 이용료가 없습니다.",
  },
];

/** 콜라보 구성 카드 중 넓은 칸(PC 세 칸 중 두 칸) — 넓은 · 좁은이 줄마다 엇갈리게(세무 핵심 서비스처럼). */
const WIDE_FORMATS = new Set([0, 3, 4]);

/** 진행 방식 — 단계마다 누가 하는지(브랜드 · admix · 매장) 칩으로. 11-13 판의 여섯 단계(11-17 되살림) 그대로. */
type Actor = "brand" | "admix" | "partner";
const FLOW: { title: string; who: Actor[]; body: string }[] = [
  {
    title: "의뢰",
    who: ["brand"],
    body: "구성 · 기간 · 원하는 매장을 담아 의뢰합니다.",
  },
  {
    title: "기획안",
    who: ["admix"],
    body: "admix가 기획안을 보내고, 브랜드가 확인하면 확정됩니다.",
  },
  {
    title: "매장 모집",
    who: ["partner"],
    body: "매장이 선착순으로 참여를 신청합니다.",
  },
  {
    title: "매장 확정",
    who: ["brand", "partner"],
    body: "브랜드가 살펴본 뒤 매장이 최종 확정합니다.",
  },
  {
    title: "진행",
    who: ["admix", "partner"],
    body: "준비 · 설치를 마치면 시작하고, 중간 보고로 상황을 알립니다.",
  },
  {
    title: "결과 보고",
    who: ["admix"],
    body: "철수 후 결과 보고서를 전달합니다.",
  },
];

/** 진행 방식 칩 — 누가 하는지 아주 옅은 색만(브랜드 보라 · 매장 노랑 · admix 회색, 11-13 판과 같은 짝). */
const ACTOR: Record<Actor, { label: string; className: string }> = {
  brand: {
    label: "브랜드",
    className:
      "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
  },
  partner: {
    label: "매장",
    className:
      "bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  },
  admix: { label: "admix", className: "bg-gray-100 text-gray-700" },
};

/** admix가 맡는 일 — 진행 순서대로 한 문장씩. 운영 관리는 "문제를 대신 처리해요"처럼 책임을 떠맡는 말은 쓰지 않는다(11-17 사용자). */
const ADMIX_PART: { title: string; body: string }[] = [
  {
    title: "매장 확인",
    body: "admix가 직접 확인한 매장만 사진과 정보를 올립니다.",
  },
  {
    title: "운영 관리",
    body: "매장과 일정을 맞추고, 진행 상황을 꾸준히 확인합니다.",
  },
  {
    title: "제작 · 설치 · 철수",
    body: "제작을 맡기면 만들어서 설치하고, 끝나면 철수합니다.",
  },
  {
    title: "보고서",
    body: "설치했을 때, 진행 중간, 끝난 뒤에 보고서를 보내 드립니다.",
  },
];

/** 이용 방법 — 브랜드(광고주 회원) · 매장(제휴사)이 각각 하는 일. 글은 11-17 판 그대로, 카드 제목만 붙였다. */
const AUDIENCES: {
  id: "advertiser" | "partner";
  label: string;
  items: { icon: string; title: string; body: string }[];
}[] = [
  {
    id: "advertiser",
    label: "브랜드",
    items: [
      {
        icon: "/icons/stroke-store.svg",
        title: "매장 고르기",
        body: "매장 사진과 금액을 보고 고릅니다.",
      },
      {
        icon: "/icons/heart.svg",
        title: "관심 매장",
        body: "마음에 드는 매장은 관심 매장에 담아 둡니다.",
      },
      {
        icon: "/icons/dashboard.svg",
        title: "진행 확인",
        body: "의뢰 내용과 진행 상황, 보고서를 한 화면에서 봅니다.",
      },
    ],
  },
  {
    id: "partner",
    label: "매장",
    items: [
      {
        icon: "/icons/tag.svg",
        title: "비용 없음",
        body: "등록비 · 이용료가 없습니다.",
      },
      {
        icon: "/icons/stroke-square-check.svg",
        title: "참여 선택",
        body: "콜라보마다 참여 여부를 직접 고릅니다.",
      },
      {
        icon: "/icons/box.svg",
        title: "설치 · 철수",
        body: "설치 · 철수는 admix가 합니다.",
      },
    ],
  },
];

export function PartnersLanding({ member = false }: { member?: boolean }) {
  const { data: me } = useMe();
  // 광고주 · 제휴사가 ?intro=1 로 보면 가입 대신 대시보드로, 다른 유형 회원은 회원 유형 바꾸기로.
  const collabMember = canUsePartners(me?.member_category);
  const otherMember = (member || !!me) && !collabMember;
  const top = useRef<HTMLDivElement>(null);
  // 회원 유형 바꾸기 창(내 정보와 같은 창) — 첫 화면 · 아래 띠 버튼이 같이 연다(11-17 사용자: "페이지 이동 말고 팝업").
  // 광고주 · 제휴사로 바꾸면 내 정보를 다시 받아 PartnersHome 이 대시보드로 옮겨 준다.
  const [categoryOpen, setCategoryOpen] = useState(false);
  // 첫 화면(사진 위)과 아래 보라 띠는 버튼 색이 다르다 — 사진 위는 어두운 회색 · 흰색이고 마우스를 올리면 보라(11-19 사용자).
  const actions = (onPhoto: boolean) => (
    <StartActions
      onPhoto={onPhoto}
      collabMember={collabMember}
      otherMember={otherMember}
      onChangeCategory={() => setCategoryOpen(true)}
    />
  );

  return (
    <div
      ref={top}
      // data-partners-landing — 본문(main)이 이 화면일 때만 바탕을 흰색으로(globals.css).
      data-partners-landing=""
      // 본문 상자의 폭 제한 · 여백은 이 화면에서 풀린다(globals.css) — 첫 화면은 본문 끝까지, 아래 구역은 여기서 1120px 상자에.
      className="flex flex-col"
    >
      <Hero actions={actions(true)} otherMember={otherMember} />
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-[120px] px-[16px] pt-[96px] pb-[calc(40px+var(--partners-tabbar-space,0px))] sm:gap-[200px] sm:px-[24px] sm:pt-[160px] sm:pb-[72px]">
        <Overview />
        <Formats />
        <Flow />
        <AdmixPart />
        <Audiences />
        <StartBand actions={actions(false)} />
        <BackToTop target={top} />
      </div>
      <CategoryChangeModal
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        current={me?.member_category}
      />
    </div>
  );
}

/* ── 첫 화면 ─────────────────────────────────────────────────────────── */

const OVERVIEW_ID = "partners-overview";

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/**
 * 첫 화면 — 배경(처음엔 흑백 사진, 11-19 어노브 필오프 영상으로 바꿈)이 본문을 꽉 채우고(폭 · 보이는 높이 전부, 휴대폰 아래 탭 바만큼 뺀다) 그 위에 제목 · 버튼만
 * (11-19 사용자: 넷째 레퍼런스의 "첫 시작하는 이미지 부분이 좋다" → "더 간단하게, 사진 위에" · "말풍선 다 빼줘" → "사진이 화면을 꽉 채우게,
 * 아래 스크롤이 있다는 걸 명확히"). 글은 왼쪽 아래(아래 구역과 같은 1120px 상자 왼쪽 끝) — 사진 속 사람을 가리지 않게,
 * 아래 · 왼쪽으로 어둡게 덮어 흰 글이 읽히게 한다(색은 #000 고정 — black 토큰은 다크 모드에서 밝게 뒤집힌다).
 * 맨 아래 가운데 마우스 아이콘(ScrollMouseIcon) + 겹화살표가 같이 오르내린다(누르면 소개로, 11-19 사용자: 글자 "아래로 스크롤"은 빼고 이 아이콘으로).
 */
function Hero({
  actions,
  otherMember,
}: {
  actions: ReactNode;
  otherMember: boolean;
}) {
  return (
    <section className="relative h-[calc(100cqh-var(--partners-tabbar-space,0px))] min-h-[520px] overflow-hidden bg-[#16131f]">
      <HeroVideo />
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-t from-[#000]/80 via-[#000]/30 to-[#000]/5"
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-linear-to-r from-[#000]/45 via-[#000]/10 to-transparent sm:block"
      />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1120px] px-[24px] pb-[120px] sm:px-[40px] sm:pb-[136px]">
        <h1 className="text-[34px] leading-[1.28] font-bold tracking-[-0.04em] break-keep text-white sm:text-[52px] xl:text-[60px]">
          브랜드와 매장을 잇는
          <br />
          admix 콜라보
        </h1>
        {/* 휴대폰도 좌우 나란히, 작게(11-13 사용자). */}
        <div className="mt-[24px] flex flex-row flex-wrap items-center gap-[8px] sm:mt-[32px] sm:gap-[10px]">
          {actions}
        </div>
        {otherMember && (
          <p className="mt-[14px] max-w-[420px] text-[13px] leading-[1.6] break-keep text-white/70">
            콜라보는 브랜드 · 매장 회원만 이용할 수 있습니다.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() =>
          document
            .getElementById(OVERVIEW_ID)
            ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" })
        }
        aria-label="아래로 스크롤"
        className="absolute bottom-[20px] left-1/2 flex -translate-x-1/2 cursor-pointer text-white/90 transition-colors hover:text-white sm:bottom-[32px]"
      >
        {/* 홈과 같은 마우스 아이콘 + 아래 겹화살표(원래 #888 회색) — 어두운 사진 위라 선 · 옅은 칠을 글자색(흰색)으로.
            둘이 한 묶음으로 같이 오르내린다(11-19 사용자: "마우스 밑에 아래 화살표 … 같이 움직이게"). */}
        <span
          aria-hidden
          className="flex animate-[partners-scroll-bob_1.6s_ease-in-out_infinite] flex-col items-center gap-[2px] motion-reduce:animate-none"
        >
          <ScrollMouseIcon className="size-[28px] sm:size-[32px] [&_path]:stroke-current [&_path:first-child]:fill-current" />
          <ChevronDoubleDownIcon className="h-[11px] w-[10px] sm:h-[13px] sm:w-[12px]" />
        </span>
      </button>
    </section>
  );
}

/**
 * 첫 화면 배경 영상 — 어노브 필오프 옥외광고 현장(11-19 사용자: 흑백 사진을 "어노브 필오프 OOH_2025.mp4로 바꿔줘").
 * 원본(VP9 · 소리 있음 · 8.4MB)은 아이폰 사파리에서 안 나올 수 있어 소리를 빼고 H.264 로 다시 뽑았다
 * (public/videos/partners-landing — PC 1080p 7.8MB, 휴대폰 720p 4.6MB). 광고 색이 중요해 흑백으로 바꾸지 않는다.
 * 소리 없이 자동 재생 · 반복 — React 는 muted 를 HTML 에 안 적어(서버 렌더) 사파리가 자동 재생을 막을 수 있어 붙은 뒤 다시 켠다.
 * 움직임 줄이기면 재생하지 않고 첫 장면(poster)만.
 */
function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
      return;
    }
    v.play().catch(() => {});
  }, []);
  return (
    <video
      ref={ref}
      aria-hidden
      autoPlay
      muted
      loop
      playsInline
      poster="/images/partners-landing/hero-video-poster.jpg"
      className="absolute inset-0 size-full object-cover"
    >
      <source
        src="/videos/partners-landing/unove-peeloff-ooh-2025-720.mp4"
        type="video/mp4"
        media="(max-width: 767px)"
      />
      <source
        src="/videos/partners-landing/unove-peeloff-ooh-2025-1080.mp4"
        type="video/mp4"
      />
    </video>
  );
}

/* ── 소개 · 사진 세 칸 ────────────────────────────────────────────────── */

/**
 * 가운데 작은 보라 머리 · 제목 · 설명 → 보라 점선이 내려와 → 사진 세 칸(다크 레퍼런스의 Overview → Background).
 * 사진 칸은 위아래로 어둡게 덮어 흰 글이 읽히게 한다 — 사진을 넣어도 그대로.
 */
function Overview() {
  return (
    <section id={OVERVIEW_ID} className="scroll-mt-[32px]">
      <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
        <Eyebrow>콜라보 소개</Eyebrow>
        <h2 className={H2}>매장 공간에서 진행하는 브랜드 콜라보</h2>
        <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>
          구성은 매장마다 가능한 범위 안에서 고릅니다.
        </p>
      </Reveal>
      <div aria-hidden className="flex flex-col items-center">
        <span className="mt-[40px] h-[72px] border-l-2 border-dotted border-primary-300 sm:mt-[56px] sm:h-[112px]" />
        <span className="size-[9px] rounded-full bg-primary" />
      </div>
      <div className="mt-[40px] grid overflow-hidden rounded-[24px] sm:mt-[56px] sm:rounded-[28px] lg:grid-cols-3">
        {ROLES.map((r, i) => (
          <RoleColumn key={r.chip} role={r} index={i} />
        ))}
      </div>
    </section>
  );
}

function RoleColumn({
  role: r,
  index: i,
}: {
  role: (typeof ROLES)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(i * 120);
  return (
    <div
      ref={revealRef}
      style={reveal.style}
      className={cn(
        // 칸 사이 옅은 흰 선 — 사진을 넣기 전(회색 한 판)에도 세 칸이 갈려 보이게.
        "relative flex h-[300px] flex-col items-center justify-center px-[24px] text-center not-first:border-white/25 max-lg:not-first:border-t sm:h-[420px] lg:h-[480px] lg:not-first:border-l",
        reveal.className,
      )}
    >
      <ImageSlot
        src={r.image}
        sizes="(min-width: 1024px) 360px, 100vw"
        className="absolute inset-0"
      />
      <span
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-[#000]/55 via-[#000]/50 to-[#000]/75"
      />
      <span className="relative rounded-full bg-white/15 px-[12px] py-[4px] text-[13px] font-semibold text-white ring-1 ring-white/30 backdrop-blur-sm">
        {r.chip}
      </span>
      <h3 className="relative mt-[16px] text-[24px] leading-[1.38] font-bold tracking-[-0.03em] break-keep text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-[28px]">
        {r.title[0]}
        <br />
        {r.title[1]}
      </h3>
      <p className="absolute inset-x-[24px] bottom-[24px] text-[13px] break-keep text-white/80 sm:bottom-[32px] sm:text-[14px]">
        {r.note}
      </p>
    </div>
  );
}

/* ── 콜라보 구성 ─────────────────────────────────────────────────────── */

/**
 * 가운데 제목(두째 줄만 보라) + 크고 작은 회색 카드 묶음 — 카드마다 제목 · 설명 + 그림 칸(세무 핵심 서비스).
 * PC는 세 칸 기준으로 넓은 칸(두 칸) · 좁은 칸이 줄마다 엇갈리고, 넓은 칸은 글 왼쪽 · 그림 오른쪽. 태블릿 두 칸, 휴대폰 한 칸.
 * 순서 · 이름 · 설명은 매장 "가능 범위"(COLLAB_SCOPE_ITEMS)와 같다(11-17 사용자).
 */
function Formats() {
  return (
    <section>
      <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
        <Eyebrow>콜라보 구성</Eyebrow>
        <h2 className={H2}>
          매장에서 할 수 있는
          <br />
          <span className="text-primary">여섯 가지 콜라보</span>
        </h2>
        <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>
          의뢰서에서 원하는 구성을 골라 담으면 됩니다.
        </p>
      </Reveal>
      <ul className="mt-[40px] grid gap-[12px] sm:mt-[64px] sm:grid-cols-2 sm:gap-[16px] lg:grid-cols-3">
        {COLLAB_SCOPE_ITEMS.map((item, i) => (
          <FormatCard
            key={item.key}
            item={item}
            index={i}
            wide={WIDE_FORMATS.has(i)}
          />
        ))}
      </ul>
    </section>
  );
}

function FormatCard({
  item,
  index: i,
  wide,
}: {
  item: (typeof COLLAB_SCOPE_ITEMS)[number];
  index: number;
  wide: boolean;
}) {
  // 한 줄(두 장)씩 차례로.
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 2) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        "flex min-w-0 flex-col gap-[20px] rounded-[24px] bg-gray-50 p-[24px] sm:p-[28px]",
        wide &&
          "lg:col-span-2 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:items-stretch lg:gap-[28px]",
        reveal.className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-[19px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:text-[21px]">
          {item.label}
        </h3>
        <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
          {item.desc}
        </p>
      </div>
      <ImageSlot
        src={sample(`format-${item.key}`)}
        sizes="(min-width: 1024px) 420px, (min-width: 640px) 50vw, 100vw"
        className={cn(
          "mt-auto h-[120px] rounded-[16px] sm:h-[180px]",
          wide && "lg:mt-0 lg:h-auto lg:min-h-[200px]",
        )}
      />
    </li>
  );
}

/* ── 진행 방식 ───────────────────────────────────────────────────────── */

/** 가운데 제목 + 흰 단계 카드 두 칸(테두리 없이 옅은 그림자) — 왼쪽 "N단계"(보라) · 제목 · 설명 · 누가 하는지, 오른쪽 작은 그림 칸(세무 업무 절차). */
function Flow() {
  return (
    <section>
      <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
        <Eyebrow>진행 방식</Eyebrow>
        <h2 className={H2}>
          의뢰부터 결과 보고까지
          <br />
          <span className="text-primary">콜라보 진행 과정</span>
        </h2>
        <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>
          진행 상황과 보고서는 화면에서 바로 확인합니다.
        </p>
      </Reveal>
      <ol className="mt-[40px] grid gap-[12px] sm:mt-[64px] sm:grid-cols-2 sm:gap-[16px]">
        {FLOW.map((step, i) => (
          <FlowCard key={step.title} step={step} index={i} />
        ))}
      </ol>
    </section>
  );
}

function FlowCard({
  step: s,
  index: i,
}: {
  step: (typeof FLOW)[number];
  index: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>((i % 2) * 110);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        // 테두리 대신 옅은 그림자(11-19 사용자: "테두리 말고 다른 카드 UI") — 다크는 그림자가 안 보여 한 단계 밝은 바탕으로.
        "flex items-start justify-between gap-[16px] rounded-[20px] bg-surface p-[20px] shadow-[0_1px_3px_rgba(42,20,89,0.05),0_10px_28px_rgba(42,20,89,0.07)] sm:p-[28px] dark:bg-gray-50 dark:shadow-none",
        reveal.className,
      )}
    >
      <div className="min-w-0">
        <span className="text-[13px] font-bold text-primary sm:text-[14px]">
          {i + 1}단계
        </span>
        <h3 className="mt-[6px] text-[18px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:text-[20px]">
          {s.title}
        </h3>
        <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
          {s.body}
        </p>
        <span className="mt-[14px] flex flex-wrap gap-[4px]">
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
      <ImageSlot
        src={sample(`flow-${i + 1}`)}
        sizes="88px"
        className="size-[64px] shrink-0 rounded-[16px] sm:size-[88px] sm:rounded-[20px]"
      />
    </li>
  );
}

/* ── admix 운영 ──────────────────────────────────────────────────────── */

/**
 * 회색 판(오른쪽 위만 크게 둥글게) — 왼쪽 제목 · 설명 · 넘기기 버튼, 오른쪽 카드 줄은 판 오른쪽 끝까지 이어지고 가로로 넘긴다.
 * 첫 장만 보라(전자서명 보안 구역). 휴대폰은 손가락으로 넘긴다(넘기기 버튼은 태블릿 · PC만).
 */
function AdmixPart() {
  const [row, setRow] = useState<HTMLOListElement | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const measure = useCallback(() => {
    if (!row) return;
    setEdge({
      start: row.scrollLeft <= 2,
      end: row.scrollLeft + row.clientWidth >= row.scrollWidth - 2,
    });
  }, [row]);
  useEffect(() => {
    if (!row) return;
    // 처음 관찰할 때도 한 번 불린다 — 카드가 다 들어가면(넓은 화면) "다음"도 막힌다.
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [row, measure]);
  const go = (dir: 1 | -1) => {
    const card = row?.querySelector("li");
    if (!row || !card) return;
    row.scrollBy({
      left: dir * (card.clientWidth + 12),
      behavior: scrollBehavior(),
    });
  };

  return (
    <Reveal>
      <section className="grid gap-[32px] overflow-hidden rounded-[28px] bg-gray-50 py-[48px] pl-[24px] sm:rounded-[36px] sm:py-[72px] sm:pl-[48px] lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-[48px] lg:rounded-tr-[160px] lg:py-[88px] lg:pl-[56px]">
        <div className="min-w-0 pr-[24px] sm:pr-[48px] lg:pr-0">
          <Eyebrow>admix 운영</Eyebrow>
          <h2 className={H2}>
            admix가
            <br />
            맡는 일
          </h2>
          <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>
            콜라보에 필요한 준비와 관리는 admix가 맡습니다.
          </p>
          <div className="mt-[28px] flex gap-[8px] max-sm:hidden">
            <Button
              isIconOnly
              variant="outline"
              aria-label="이전 카드"
              isDisabled={edge.start}
              onPress={() => go(-1)}
              className="size-[44px] rounded-full border-gray-300 bg-surface"
            >
              <ChevronLeftIcon className="size-[18px]" />
            </Button>
            <Button
              isIconOnly
              variant="outline"
              aria-label="다음 카드"
              isDisabled={edge.end}
              onPress={() => go(1)}
              className="size-[44px] rounded-full border-gray-300 bg-surface"
            >
              <ChevronRightIcon className="size-[18px]" />
            </Button>
          </div>
        </div>
        <ol
          ref={setRow}
          onScroll={measure}
          className="flex snap-x snap-mandatory scroll-pl-[2px] gap-[12px] overflow-x-auto pr-[24px] pb-[4px] [scrollbar-width:none] sm:pr-[48px] [&::-webkit-scrollbar]:hidden"
        >
          {ADMIX_PART.map((p, i) => (
            <li
              key={p.title}
              className={cn(
                "flex min-h-[260px] w-[236px] shrink-0 snap-start flex-col rounded-[24px] p-[24px] sm:min-h-[300px] sm:w-[264px] sm:p-[28px]",
                i === 0
                  ? "bg-primary text-white"
                  : "bg-surface text-gray-900 ring-1 ring-gray-100",
              )}
            >
              <span
                className={cn(
                  "w-fit border-b-2 pb-[2px] text-[15px] font-bold",
                  i === 0
                    ? "border-white/80 text-white"
                    : "border-gray-900 text-gray-900",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-[28px] text-[21px] leading-[1.38] font-bold tracking-[-0.02em] break-keep sm:text-[24px]">
                {p.title}
              </h3>
              <p
                className={cn(
                  "mt-[12px] text-[14px] leading-[1.65] break-keep sm:text-[15px]",
                  i === 0 ? "text-white/80" : "text-gray-500",
                )}
              >
                {p.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  );
}

/* ── 이용 방법 ───────────────────────────────────────────────────────── */

/** 왼쪽 제목 · 설명, 오른쪽 브랜드 · 매장 두 줄 카드 — 오른쪽 줄을 조금 내려 엇갈리게(전자서명 계약서 양식). 휴대폰은 한 줄. */
function Audiences() {
  return (
    <section className="grid gap-[36px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-[56px]">
      <Reveal className="lg:sticky lg:top-[40px] lg:self-start">
        <Eyebrow>이용 방법</Eyebrow>
        <h2 className={H2}>
          브랜드와 매장의
          <br />
          이용 방법
        </h2>
        <p className={cn(LEAD, "mt-[16px] max-w-[380px] sm:mt-[20px]")}>
          회원 유형에 따라 쓰는 화면이 다릅니다.
        </p>
      </Reveal>
      <div className="grid gap-[12px] sm:grid-cols-2 sm:gap-[16px]">
        {AUDIENCES.map((a, col) => (
          <div
            key={a.id}
            className={cn(
              "flex flex-col gap-[12px] sm:gap-[16px]",
              col === 1 && "sm:mt-[64px]",
            )}
          >
            <span className="w-fit rounded-full bg-gray-100 px-[12px] py-[4px] text-[13px] font-semibold text-gray-700 max-sm:mt-[12px]">
              {a.label}
            </span>
            {a.items.map((it, i) => (
              <AudienceCard
                key={it.title}
                item={it}
                delay={col * 140 + i * 90}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function AudienceCard({
  item,
  delay,
}: {
  item: (typeof AUDIENCES)[number]["items"][number];
  delay: number;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(delay);
  return (
    <div
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
    </div>
  );
}

/* ── 시작 띠 ─────────────────────────────────────────────────────────── */

/** 보라 띠(PC는 알약 모양) — 왼쪽 한 줄, 오른쪽 흰 버튼(전자서명 자료 받기 띠). 회원 유형별 버튼은 첫 화면과 같다. */
function StartBand({ actions }: { actions: ReactNode }) {
  return (
    <Reveal>
      <section className="flex flex-col gap-[20px] rounded-[28px] bg-primary px-[24px] py-[32px] shadow-[0_20px_40px_-16px_rgba(122,63,224,0.55)] sm:px-[40px] lg:flex-row lg:items-center lg:justify-between lg:rounded-full lg:py-[28px] lg:pr-[28px] lg:pl-[56px]">
        <h2 className="text-[20px] leading-[1.4] font-bold tracking-[-0.02em] break-keep text-white sm:text-[24px]">
          admix 콜라보, 지금 시작
        </h2>
        <div className="flex flex-row flex-wrap items-center gap-[8px]">
          {actions}
        </div>
      </section>
    </Reveal>
  );
}

/* ── 공용 ────────────────────────────────────────────────────────────── */

/** 구역 제목 위 작은 보라 글자(레퍼런스의 작은 머리) — 번호 없이 구역 이름만. */
function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="mb-[12px] block text-[14px] font-semibold text-primary sm:mb-[16px] sm:text-[15px]">
      {children}
    </span>
  );
}

/**
 * 이미지 칸 — 회색 바탕 위에 사진을 칸 크기에 맞춰 채운다(object-cover). src 가 없으면 회색 칸 그대로
 * (11-19 사용자: 처음엔 "회색 배경으로 비워줘", 이어서 "샘플 이미지들을 넣어 줄 수 있어?"). data-image-slot 으로 찾기 쉽게.
 * 사진은 꾸밈이라 글로 읽지 않는다(aria-hidden · alt 빈칸) — 같은 내용이 옆 글에 있다.
 */
function ImageSlot({
  src,
  sizes,
  priority = false,
  className,
}: {
  src?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      data-image-slot=""
      className={cn("relative overflow-hidden bg-gray-200", className)}
    >
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      )}
    </div>
  );
}

/** 회원 유형별 시작 버튼 — 콜라보 회원은 대시보드, 다른 유형 회원은 회원 유형 바꾸기(창), 비회원은 브랜드 · 매장 가입. */
function StartActions({
  onPhoto,
  collabMember,
  otherMember,
  onChangeCategory,
}: {
  onPhoto: boolean;
  collabMember: boolean;
  otherMember: boolean;
  onChangeCategory: () => void;
}) {
  if (collabMember)
    return (
      <CtaLink href={PARTNERS_DASHBOARD_HREF} onPhoto={onPhoto} solid>
        대시보드로 가기
      </CtaLink>
    );
  if (otherMember)
    return (
      <button
        type="button"
        onClick={onChangeCategory}
        className={ctaClass(true, onPhoto)}
      >
        회원 유형 바꾸기
        <CtaArrow />
      </button>
    );
  return (
    <>
      <CtaLink href={ADVERTISER_SIGNUP_HREF} onPhoto={onPhoto} solid>
        브랜드로 시작하기
      </CtaLink>
      <CtaLink href={PARTNER_SIGNUP_HREF} onPhoto={onPhoto}>
        매장으로 시작하기
      </CtaLink>
    </>
  );
}

/**
 * 시작 버튼.
 * - 첫 화면 사진 위(onPhoto): solid 어두운 회색(사이트 어두운 버튼 · "맨 위로"와 같은 gray-800 #262a3d — 처음 넣은 남색은
 *   "이 사이트에서 자주 사용하는 어두운 색"으로 바꿈) · 아니면 흰색, 마우스를 올리면 둘 다 보라 바탕 + 흰 글(11-19 사용자).
 * - 아래 보라 띠: solid 흰 알약(마우스를 올리면 연보라) · 아니면 흰 테두리 — 보라 바탕이라 보라로 바뀌면 안 보인다.
 * 색은 hex 로 고정한 곳이 있다 — 회색 · 남색 토큰은 다크 모드에서 밝게 뒤집힌다.
 */
function CtaLink({
  href,
  onPhoto,
  solid = false,
  children,
}: {
  href: string;
  onPhoto: boolean;
  solid?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={ctaClass(solid, onPhoto)}>
      {children}
      <CtaArrow />
    </Link>
  );
}

function ctaClass(solid: boolean, onPhoto: boolean) {
  return cn(
    "group inline-flex h-[42px] cursor-pointer items-center gap-[6px] rounded-full border px-[16px] text-[13px] font-semibold whitespace-nowrap transition-colors sm:h-[52px] sm:px-[26px] sm:text-[15px]",
    onPhoto
      ? solid
        ? "border-transparent bg-[#262a3d] text-white hover:bg-primary"
        : "border-transparent bg-white text-[#16131f] hover:bg-primary hover:text-white"
      : solid
        ? "border-transparent bg-white text-gray-900 hover:bg-primary-50 hover:text-primary-700 dark:text-[#16131f]"
        : "border-white/60 bg-transparent text-white hover:bg-white/10",
  );
}

function CtaArrow() {
  return (
    <ArrowLeftIcon className="size-[14px] rotate-180 transition-transform group-hover:translate-x-[2px] sm:size-[16px]" />
  );
}

/**
 * 맨 위로 — 이 화면은 창이 아니라 본문(main)이 스크롤되므로, 소개를 감싼 칸에서 위로 올라가며 스크롤되는 상자를 찾아 올린다
 * (없으면 창). 색은 남색 기운의 진한 회색(11-13 사용자: "회색이나 남색으로").
 */
function BackToTop({ target }: { target: RefObject<HTMLElement | null> }) {
  const goTop = () => {
    const behavior = scrollBehavior();
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
    <Reveal className="-mt-[48px] flex justify-center sm:-mt-[120px]">
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
 * 15%쯤 보이면 시작하고, 한 번 나타나면 그대로 둔다. delay(ms): 나란한 것들을 하나씩 차례로. 움직임 줄이기면 처음부터 보인다.
 */
function useReveal<T extends HTMLElement>(delay = 0) {
  // 요소는 콜백 ref 로 받는다 — 렌더 중에 ref 객체를 넘기지 않게(react-hooks/refs).
  const [el, ref] = useState<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
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
