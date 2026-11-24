"use client";

import { Button, ScrollShadow, Tabs } from "@heroui/react";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { MaskIcon } from "@/components/common/MaskIcon";
import {
  ChevronDoubleDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ScrollMouseIcon,
} from "@/components/icons";
import { openLoginModalTo } from "@/app/(client)/(main)/_components/useLoginModal";
import { useMe } from "@/hooks/auth";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { COLLAB_SCOPE_ITEMS } from "@/lib/partners";
import { cn } from "@/lib/utils";

import { openAdvertiserOnlyNotice } from "./AdvertiserOnlyNotice";
import {
  ACTOR,
  BackToTop,
  bodyClass,
  CtaArrow,
  ctaClass,
  Eyebrow,
  FORMAT_COPY,
  H2,
  ImageSlot,
  LEAD,
  Reveal,
  scrollBehavior,
  StartActions,
  StartBand,
  useCollabStart,
  useReveal,
} from "./landingKit";
import { openBizGate, useAdvBizLock } from "./workspace/ProvisionalGate";

/*
 * 말투(11-19 사용자: "말투가 요체인데 담백하게") — 이 화면만 해요체를 쓰지 않는다. 제목은 명사로 맺고(레퍼런스처럼),
 *   설명 · 카드 글은 합니다체 짧은 문장. 버튼 이름(…로 시작하기 · … 보기 · 대시보드로 가기)은 그대로.
 * 11-23: 첫 화면 비회원 버튼은 하위 안내 페이지로(브랜드 협업 구성 /partners/about/brand · 매장 참여 방법 /partners/about/store)
 *   → 같은 날 "브랜드 협업 구성 보기"는 아래 콜라보 구성으로 스크롤, 둘째는 "콜라보 의뢰하기"(의뢰서 작성하기와 같은 동작)로 바꿨다.
 *   공용 조각(제목 · 등장 · 이미지 칸 · 시작 버튼 · 맨 위로)은 landingKit.tsx.
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

/**
 * 소개 사진 세 칸 — 누가 무엇을 하는지(브랜드 · admix · 매장). 제목 · 설명은 11-23 사용자가 준 내용을 다듬은 것.
 * 사진은 11-23 사용자가 public/images 에 넣은 partners_1 · 2 · 3(2는 png) — 같은 날 먼저 넣은 role-*-unove.jpg(작아서 흐림)를 바꿨다
 *   ("배경 이미지를 partners_1.jpg로 …"). 처음 넣은 Pexels role-*.jpg 는 지웠다(그중 둘은 about-* 로 소개 하위 페이지 머리가 쓴다).
 * note — 문장마다 한 줄로 시작한다(길면 그 안에서 줄바꿈).
 */
/**
 * 마우스를 올리면 떠오름 — 콜라보 구성 카드(11-23 사용자, 소개 세 칸은 LIFT_ROLE).
 * 처음 6px · 짙은 그림자는 "너무 과하다" → 3px · 옅은 그림자 → "더 올라오게, 그림자가 안 어울려" → 6px.
 * 그림자는 아래 끝에만 몰린 짙은 띠 대신 카드 둘레로 넓게 퍼지는 옅은 그림자 — 회색 카드 아래 때처럼 보이지 않게.
 * 터치 기기에선 hover 가 없다(Tailwind v4). 움직임 줄이기면 그림자만.
 */
const LIFT =
  "transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-[6px] hover:shadow-[0_20px_48px_-20px_rgba(22,19,31,0.16)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";
/** 소개 세 칸은 "조금 더 올라오게"(11-23 사용자) — 8px · 그림자도 그만큼. 나머지 칸은 어둡게 덮어 올린 칸에 눈이 가게(RoleColumn). */
const LIFT_ROLE =
  "transition-[translate,box-shadow] duration-300 ease-out hover:-translate-y-[8px] hover:shadow-[0_22px_36px_-18px_rgba(22,19,31,0.4)] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

const ROLES: {
  chip: string;
  image: string;
  title: [string, string];
  note: string[];
}[] = [
  {
    chip: "브랜드",
    image: "/images/partners_1.jpg",
    title: ["원하는 매장과", "협업 방식 선택"],
    note: ["캠페인 목적에 맞는 매장과 희망 구성을 담아 의뢰합니다."],
  },
  {
    chip: "admix",
    image: "/images/partners_2.png",
    title: ["기획부터", "현장 운영까지"],
    note: [
      "브랜드 요청을 바탕으로 협업을 기획합니다.",
      "매장과 일정을 조율합니다.",
      "제작 · 설치 · 철수와 결과 보고까지 진행합니다.",
    ],
  },
  {
    chip: "매장",
    image: "/images/partners_3.jpg",
    title: ["우리 매장에 맞는", "협업에 참여"],
    note: [
      "등록비와 이용료 없이 제휴를 신청합니다.",
      "캠페인 일정을 확인하고 참여 여부를 직접 정합니다.",
    ],
  },
];

/**
 * 진행 방식 — 여섯 단계(11-13 판 · 11-17 되살림)마다 브랜드 · 매장이 하는 일. 하지 않는 단계는 비운다.
 * admix 몫(기획안 · 준비 · 설치 · 결과 보고)은 표 아래 한 줄과 다음 구역(AdmixPart)이 말한다(11-23 사용자 레퍼런스: 브랜드 · 매장 두 줄 표).
 */
const FLOW: { title: string; brand?: string; partner?: string }[] = [
  { title: "의뢰", brand: "의뢰서 작성" },
  { title: "기획안", brand: "기획안 확정" },
  { title: "매장 모집", partner: "선착순 참여 신청" },
  { title: "매장 확정", brand: "신청 매장 확인", partner: "참여 최종 확정" },
  { title: "진행", brand: "중간 보고 확인", partner: "준비 · 매장 운영" },
  { title: "결과 보고", brand: "결과 보고서 확인" },
];

/** admix가 맡는 일 — 진행 순서대로 한 문장씩. 운영 관리는 "문제를 대신 처리해요"처럼 책임을 떠맡는 말은 쓰지 않는다(11-17 사용자). */
// 11-23 사용자 문구를 다듬음 — "캠페인"은 이 화면 용어 "콜라보"로, "사전에"는 "미리"로.
const ADMIX_PART: { title: string; body: string }[] = [
  {
    title: "제휴 매장 확인",
    body: "admix가 직접 확인한 매장의 사진과 정보를 제공합니다.",
  },
  {
    title: "운영 관리",
    body: "브랜드와 매장의 일정을 조율하고, 콜라보 진행 상황을 공유합니다.",
  },
  {
    title: "제작 · 설치 · 철수",
    body: "제작을 의뢰하면 미리 협의한 범위대로 만들고, 현장 설치 · 철수를 조율합니다.",
  },
  {
    title: "결과 보고서 제공",
    body: "현장 사진, 제품 배포 수량 등 미리 정한 운영 항목을 보고서로 정리해 브랜드에 전달합니다.",
  },
];

/**
 * 이용 방법 — 브랜드(광고주 회원) · 매장(제휴사)이 각각 하는 일.
 * 제목은 11-23 사용자 문구(가운뎃점은 띄움, "캠페인"은 이 화면 용어 콜라보로), 설명은 사용자 글을 합니다체 한 문장으로 다듬음.
 */
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
        icon: "/icons/store.svg",
        title: "협업 매장 찾기",
        body: "매장 사진과 예상 비용을 보고 콜라보에 어울리는 매장을 고릅니다.",
      },
      {
        icon: "/icons/heart.svg",
        title: "관심 매장 저장",
        body: "마음에 드는 매장을 저장해 두고, 콜라보를 준비할 때 다시 봅니다.",
      },
      {
        icon: "/icons/presentation.svg",
        title: "진행 현황 · 결과 확인",
        body: "의뢰 내용부터 진행 상황, 결과 보고서까지 한 화면에서 확인합니다.",
      },
    ],
  },
  {
    id: "partner",
    label: "매장",
    items: [
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
        body: "설치가 필요한 콜라보는 미리 협의한 범위에서 admix가 설치와 철수를 맡습니다.",
      },
    ],
  },
];

export function PartnersLanding({ member = false }: { member?: boolean }) {
  // 아래 보라 띠: 광고주 · 제휴사가 ?intro=1 로 보면 가입 대신 대시보드로, 다른 유형 회원은 회원 유형 바꾸기(창).
  const { collabMember, otherMember, openCategory, modal } =
    useCollabStart(member);
  const top = useRef<HTMLDivElement>(null);
  // 첫 화면(사진 위)과 아래 보라 띠는 버튼 색이 다르다 — 사진 위는 어두운 회색 · 흰색이고 마우스를 올리면 보라(11-19 사용자).
  const actions = (onPhoto: boolean) => (
    <StartActions
      onPhoto={onPhoto}
      collabMember={collabMember}
      otherMember={otherMember}
      onChangeCategory={openCategory}
    />
  );
  const startRequest = useRequestStart(collabMember || otherMember);
  // 첫 화면 버튼 둘(11-23 사용자): "브랜드 협업 구성 보기"는 아래 콜라보 구성으로 스크롤(처음엔 하위 안내 페이지로 이동),
  // "콜라보 의뢰하기"는 콜라보 구성 아래 "의뢰서 작성하기"와 같은 동작(처음엔 "매장 참여 방법 보기" 하위 페이지).
  // 로그인해도 바뀌지 않는다(11-23 사용자: 다른 유형 회원이면 "회원 유형 바꾸기"로 바뀌던 것을 "안 바뀌게") — 회원 유형별 동작은 버튼이 맡는다.
  // 가입 · 대시보드 · 회원 유형 바꾸기는 아래 보라 띠에 남는다.
  const heroActions = (
    <>
      <button
        type="button"
        onClick={() => scrollToSection(FORMATS_ID)}
        className={ctaClass(true, true)}
      >
        브랜드 협업 구성 보기
        <CtaArrow />
      </button>
      <button
        type="button"
        onClick={startRequest}
        className={ctaClass(false, true)}
      >
        콜라보 의뢰하기
        <CtaArrow />
      </button>
    </>
  );

  return (
    <div
      ref={top}
      // data-partners-landing — 본문(main)이 이 화면일 때만 바탕을 흰색으로(globals.css).
      data-partners-landing=""
      // 본문 상자의 폭 제한 · 여백은 이 화면에서 풀린다(globals.css) — 첫 화면은 본문 끝까지, 아래 구역은 여기서 1120px 상자에.
      className="flex flex-col"
    >
      <Hero actions={heroActions} otherMember={otherMember} />
      <div className={bodyClass()}>
        <Overview />
        <Formats signedIn={collabMember || otherMember} />
        <Flow />
        <AdmixPart />
        <Audiences />
        <StartBand actions={actions(false)} />
        <BackToTop target={top} />
      </div>
      {modal}
    </div>
  );
}

/* ── 첫 화면 ─────────────────────────────────────────────────────────── */

const OVERVIEW_ID = "partners-overview";
/** 콜라보 구성 — 첫 화면 "브랜드 협업 구성 보기"가 여기로 스크롤한다. */
const FORMATS_ID = "partners-formats";

/** 본문(main)이 스크롤되는 화면이라 scrollIntoView 로 — 위 칸 여백은 구역의 scroll-mt. */
function scrollToSection(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: scrollBehavior(), block: "start" });
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
        onClick={() => scrollToSection(OVERVIEW_ID)}
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
        {/* 11-23 사용자 문구 — 쉼표에서 줄을 나눈다. 설명은 사용자 글("카페 메뉴부터 … 브랜드 캠페인을 제안합니다")을 짧게(캠페인 → 이 화면 용어 콜라보).
            강조는 다른 구역 제목처럼 둘째 줄만 보라("강조할 부분에 보라색", 11-23 사용자). */}
        <h2 className={H2}>
          브랜드와 매장의 협업,
          <br />
          <span className="text-primary">admix가 연결합니다</span>
        </h2>
        {/* 두 줄 설명이라 행간을 좁힌다(11-23 사용자: "행간 좁혀줘") — 다른 구역 설명은 LEAD 그대로 1.75. */}
        <p className={cn(LEAD, "mt-[16px] leading-[1.5] sm:mt-[20px]")}>
          카페 메뉴부터 굿즈 전시, 제품 체험까지.
          <br />
          매장에 어울리는 콜라보를 admix가 제안합니다.
        </p>
      </Reveal>
      <div aria-hidden className="flex flex-col items-center">
        {/* 점선 길이 — 11-23 사용자 "조금 더 짧게"(72 · 112px → 52 · 80px). */}
        <span className="mt-[40px] h-[52px] border-l-2 border-dotted border-primary-300 sm:mt-[56px] sm:h-[80px]" />
        <span className="size-[9px] rounded-full bg-primary" />
      </div>
      {/* 세 칸은 한 판 — 마우스를 올린 칸만 살짝 뜨게(11-23 사용자) 판 대신 칸마다 바깥 모서리를 둥글린다(판에서 자르면 뜬 칸 · 그림자가 잘린다). */}
      {/* group/roles — 판 위에 마우스가 있으면 올리지 않은 칸을 어둡게(RoleColumn). */}
      <div className="group/roles mt-[40px] grid sm:mt-[56px] lg:grid-cols-3">
        {ROLES.map((r, i) => (
          <RoleColumn
            key={r.chip}
            role={r}
            index={i}
            last={i === ROLES.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

function RoleColumn({
  role: r,
  index: i,
  last,
}: {
  role: (typeof ROLES)[number];
  index: number;
  last: boolean;
}) {
  const [revealRef, reveal] = useReveal<HTMLDivElement>(i * 120);
  return (
    // 바깥은 등장 효과(translate · 지연)만, 칸 모양 · 떠오름은 안쪽 — 둘을 한 곳에 두면 떠오를 때도 등장 지연 · 속도를 탄다.
    // 뜬 칸이 옆 칸 위로 그림자를 드리우게 바깥에 hover:z-10.
    <div
      ref={revealRef}
      style={reveal.style}
      className={cn("group/col relative hover:z-10", reveal.className)}
    >
      <div
        className={cn(
          // 칸 사이 옅은 흰 선 — 사진을 넣기 전(회색 한 판)에도 세 칸이 갈려 보이게.
          // 휴대폰 높이 340px — 설명이 세 줄이어도 제목과 붙지 않게(11-23, 예전 300px).
          "relative flex h-[340px] flex-col items-center justify-center overflow-hidden px-[24px] text-center sm:h-[420px] lg:h-[480px]",
          i > 0 && "border-white/25 max-lg:border-t lg:border-l",
          // 바깥 모서리만 둥글게 — 휴대폰 · 태블릿은 위아래로 쌓여 첫 칸 위 · 끝 칸 아래, PC는 첫 칸 왼쪽 · 끝 칸 오른쪽.
          i === 0 &&
            "rounded-t-[24px] sm:rounded-t-[28px] lg:rounded-tr-none lg:rounded-bl-[28px]",
          last &&
            "rounded-b-[24px] sm:rounded-b-[28px] lg:rounded-tr-[28px] lg:rounded-bl-none",
          LIFT_ROLE,
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
        {/* 설명은 점 목록(11-23 사용자: "* · 점 · - 같은 걸로 리스트 형식으로") — 목록 묶음은 칸 가운데, 줄은 왼쪽 맞춤.
          PC는 좌우 여백 16px — 24px면 점 자리만큼 모자라 브랜드 설명 끝 "의뢰합니다."가 혼자 둘째 줄로 넘어간다(1440). */}
        <ul className="absolute inset-x-[24px] bottom-[24px] mx-auto flex w-fit max-w-full flex-col gap-[4px] text-left text-[13px] leading-[1.6] break-keep text-white/80 sm:bottom-[32px] sm:text-[14px] lg:inset-x-[16px]">
          {r.note.map((line) => (
            <li key={line} className="flex gap-[8px]">
              <span
                aria-hidden
                className="mt-[0.7em] size-[4px] shrink-0 rounded-full bg-white/70"
              />
              {line}
            </li>
          ))}
        </ul>
        {/* 다른 칸에 마우스를 올리면 이 칸을 글까지 어둡게 덮는다 — 올린 칸에 눈이 가게(11-23 사용자). 이 칸 위면 덮지 않는다. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[#000]/40 opacity-0 transition-opacity duration-300 group-hover/roles:opacity-100 group-hover/col:opacity-0! motion-reduce:transition-none"
        />
      </div>
    </div>
  );
}

/* ── 콜라보 구성 ─────────────────────────────────────────────────────── */

/**
 * 가운데 제목(두째 줄만 보라) + 회색 카드 묶음 — 카드마다 제목 · 설명 + 사진.
 * 카드는 둘씩 세 짝(FORMAT_PAIRS) — 짝마다 세로 4:5 사진 하나 + 정사각형 사진 하나(FORMAT_SQUARE).
 * 11-23 사용자: 같은 크기 격자 + 모두 세로 4:5(landingKit FORMAT_GRID — 하위 페이지는 아직 그 모양)에서
 *   굿즈 · 소모품 "정사각형이 좋을 것 같아" + "전체적으로 배치를 다시" → 비율이 섞여도 끝선이 맞는 짝 배치로.
 * - PC(lg): 짝이 세로 칸 셋 — 세로 · 정사각형이 칸마다 엇갈리고(바둑판), 칸마다 두 장 합이 같아 세 칸 끝선이 맞는다.
 * - 태블릿(sm): 짝이 가로 줄 — 폭을 사진 비율대로(4:5 → 4, 정사각형 → 5) 나눠 한 줄 사진 높이가 같다.
 * - 휴대폰: 한 줄로 쌓는다.
 * 글 줄 수가 달라 남는 높이는 글과 사진 사이로 — 사진은 비율 그대로 카드 아래에 붙어 끝선이 맞는다(mt-auto).
 * 순서는 매장 "가능 범위"(COLLAB_SCOPE_ITEMS)와 같고(11-17 사용자) PC에선 칸(세로)으로 읽힌다. 이름 · 설명은 11-23 사용자 문구(FORMAT_COPY — 소개 페이지만).
 */
function Formats({ signedIn }: { signedIn: boolean }) {
  const isDesktop = useIsDesktop();
  return (
    <section id={FORMATS_ID} className="scroll-mt-[32px]">
      <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
        <Eyebrow>콜라보 구성</Eyebrow>
        {/* 11-23 사용자 문구(예전 "컵홀더부터 한정 메뉴까지, 매장에서 만나는 브랜드 콜라보" · "콜라보 목적과 매장 환경에 맞춰
            여섯 가지 구성을 조합합니다"에서 바꿈) — 둘째 줄만 보라. */}
        <h2 className={H2}>
          브랜드와 매장이 함께하는
          <br />
          <span className="text-primary">여섯 가지 콜라보</span>
        </h2>
        {/* 휴대폰에서 두 줄로 갈릴 때 끝말만 남지 않게 줄 길이를 고르게(text-balance). */}
        <p className={cn(LEAD, "mt-[16px] text-balance sm:mt-[20px]")}>
          의뢰서에서 원하는 구성을 담으면 됩니다.
        </p>
      </Reveal>
      {/* 휴대폰은 카드 여섯 장을 한 줄로 두고 좌우로 넘긴다(11-24 사용자) — 짝(ul)은 contents 로 풀어 카드가 바로 줄에 선다.
          양 끝은 HeroUI ScrollShadow 로 흐리게(넘길 카드가 더 있다는 표시), 다음 카드 끝이 살짝 보이게 카드 폭은 화면보다 좁게.
          본문 좌우 여백(16px)까지 끝까지 넘어가게 -mx · px. 태블릿 · PC는 예전 짝 배치 그대로(ScrollShadow 끔).
          HeroUI 가로 ScrollShadow 는 늘 overflow-x:auto 라 세로도 auto 가 되어, 등장 효과(아래 32px) · 마우스 올림(위로 뜸 + 그림자)에
          위아래 스크롤이 생겼다(11-24 사용자 "높이 맞춰줘") — 휴대폰은 세로만 자르고, 태블릿 · PC는 overflow 를 풀어 둔다. */}
      <ScrollShadow
        orientation="horizontal"
        hideScrollBar
        size={28}
        isEnabled={!isDesktop}
        visibility={isDesktop ? "none" : "auto"}
        className="mt-[40px] max-sm:-mx-[16px] max-sm:snap-x max-sm:snap-mandatory max-sm:scroll-px-[16px] max-sm:overflow-x-auto max-sm:overflow-y-hidden max-sm:px-[16px] sm:overflow-visible max-sm:pb-[4px] [scrollbar-width:none] sm:mt-[64px] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-[12px] sm:grid sm:gap-[16px] lg:grid-cols-3">
          {FORMAT_PAIRS.map((pair, p) => (
            <ul
              key={pair[0].key}
              className="contents sm:flex sm:flex-row sm:gap-[16px] lg:flex-col"
            >
              {pair.map((item, j) => (
                <FormatCard
                  key={item.key}
                  item={item}
                  delay={p * 80 + j * 110}
                />
              ))}
            </ul>
          ))}
        </div>
      </ScrollShadow>
      <FormatActions signedIn={signedIn} />
    </section>
  );
}

/** 의뢰서 작성 화면(광고주) — 브랜드가 없으면 그 화면이 브랜드 등록부터 연다(AdvRequestForm). */
const REQUEST_HREF = "/partners/collabs/new";

/**
 * 의뢰서 작성 시작 — 콜라보 구성 아래 "의뢰서 작성하기"(11-23 사용자 — 처음엔 회원가입 · 견적서 요청 · 기획안 작성하기 셋)와
 * 첫 화면 비회원 "콜라보 의뢰하기"(11-23 사용자: "의뢰서 작성하기 버튼과 동일한 기능")가 같이 쓴다.
 * - 비회원: 로그인 창 → 로그인하면 바로 의뢰서. 창 안 회원가입은 광고주를 미리 골라 두고, 가입을 마치면 의뢰서로(LoginModal ?next=).
 *   광고주가 아닌 계정으로 로그인하면 옮기지 않고 "광고주 회원만" 창(AdvertiserOnlyNotice).
 * - 광고주: 의뢰서로. 사업자등록증 승인 전이면 승인 안내 창(ProvisionalGate).
 * - 다른 유형 회원: "광고주 회원만" 창.
 */
function useRequestStart(signedIn: boolean) {
  const router = useRouter();
  const { data: me } = useMe();
  const advLock = useAdvBizLock();
  return () => {
    if (!signedIn) {
      openLoginModalTo(REQUEST_HREF, {
        category: "advertiser",
        onOther: openAdvertiserOnlyNotice,
      });
      return;
    }
    // 회원 정보를 아직 못 받았으면 의뢰서로 — 그 화면의 가드가 유형 · 승인을 다시 본다.
    if (me && me.member_category !== "advertiser") {
      openAdvertiserOnlyNotice();
      return;
    }
    if (advLock) {
      openBizGate();
      return;
    }
    router.push(REQUEST_HREF);
  };
}

/** 콜라보 구성 아래 "의뢰서 작성하기" — 동작은 useRequestStart(첫 화면 "콜라보 의뢰하기"와 같다). */
function FormatActions({ signedIn }: { signedIn: boolean }) {
  const start = useRequestStart(signedIn);
  return (
    <Reveal className="mt-[32px] flex justify-center sm:mt-[48px]">
      <button
        type="button"
        onClick={start}
        className="group inline-flex h-[42px] cursor-pointer items-center gap-[6px] rounded-full bg-primary px-[18px] text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-primary-700 sm:h-[52px] sm:px-[26px] sm:text-[15px]"
      >
        의뢰서 작성하기
        <CtaArrow />
      </button>
    </Reveal>
  );
}

type FormatItem = (typeof COLLAB_SCOPE_ITEMS)[number];

/**
 * 정사각형 사진 칸 — 굿즈 · 소모품(11-23 사용자: "정사각형이 좋을 것 같아", 그땐 가로 사진).
 *   같은 날 두 사진이 세로(굿즈 3:4 · 소모품 4:5)로 바뀌어 위아래가 조금 잘린다 — 소모품은 컵홀더가 남게 아래쪽(FORMAT_COPY position).
 * 공간 연출은 원본이 거의 정사각형(1440×1517)이라 4:5보다 덜 잘린다. 나머지(홍보물 · 전시 · 메뉴)는 세로 4:5 원본 그대로.
 */
const FORMAT_SQUARE: ReadonlySet<FormatItem["key"]> = new Set([
  "goods",
  "supplies",
  "space",
]);

/** 둘씩 세 짝 — [홍보물 · 굿즈] [소모품 · 전시] [메뉴 · 공간]. 짝마다 세로 하나 + 정사각형 하나. */
const FORMAT_PAIRS = [0, 2, 4].map((i) => COLLAB_SCOPE_ITEMS.slice(i, i + 2));

function FormatCard({ item, delay }: { item: FormatItem; delay: number }) {
  const [revealRef, reveal] = useReveal<HTMLLIElement>(delay);
  const square = FORMAT_SQUARE.has(item.key);
  return (
    <li
      ref={revealRef}
      style={reveal.style}
      className={cn(
        // 태블릿 줄에선 폭을 사진 비율대로 — 기본 폭은 안쪽 div 좌우 여백(28px × 2)만, 남는 폭을 grow 4 : 5로 나눠 사진 폭이 정확히 4 : 5.
        // 휴대폰은 가로로 넘기는 줄 — 폭 고정(다음 카드 끝이 보이게 화면의 약 4/5), 카드 왼쪽 끝에 맞춰 멈춘다.
        "flex min-w-0 flex-col max-sm:w-[min(78vw,300px)] max-sm:shrink-0 max-sm:snap-start sm:basis-[56px] lg:basis-auto",
        square ? "sm:grow-[5]" : "sm:grow-[4]",
        reveal.className,
      )}
    >
      {/* 카드 모양은 안쪽 div에 — 마우스를 올리면 살짝 떠오르며 아래에 옅은 그림자(LIFT, 11-23 사용자).
          li 에는 등장 효과의 translate · 지연이 걸려 있어 따로 둔다. flex-1 로 li 높이를 다 채워야 사진 끝선(mt-auto)이 맞는다. */}
      <div
        className={cn(
          // 옅은 테두리(11-23 사용자 "테두리가 살짝" → gray-200 은 "너무 진해" → gray-100) — 안쪽 ring 이라 크기가 그대로다(li 의 sm:basis-[56px] 계산이 안 바뀐다).
          "flex flex-1 flex-col gap-[20px] rounded-[24px] bg-gray-50 p-[24px] ring-1 ring-gray-100 ring-inset sm:p-[28px]",
          LIFT,
        )}
      >
        <div className="min-w-0">
          <h3 className="text-[19px] leading-[1.4] font-bold tracking-[-0.02em] text-gray-900 sm:text-[21px]">
            {FORMAT_COPY[item.key].label}
          </h3>
          <p className="mt-[6px] text-[14px] leading-[1.6] break-keep text-gray-500 sm:text-[15px]">
            {FORMAT_COPY[item.key].desc}
          </p>
        </div>
        <ImageSlot
          src={FORMAT_COPY[item.key].image}
          position={FORMAT_COPY[item.key].position}
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 55vw, 100vw"
          className={cn(
            "mt-auto w-full rounded-[16px]",
            square ? "aspect-square" : "aspect-[4/5]",
          )}
        />
      </div>
    </li>
  );
}

/* ── 진행 방식 ───────────────────────────────────────────────────────── */

/**
 * 가운데 제목 + 단계 × 브랜드 · 매장 표(11-23 사용자 레퍼런스: "PC는 가로, 모바일은 세로").
 * PC(lg)는 단계가 가로 칸(번호 · 이름 아래 보라 점을 이은 줄), 브랜드 · 매장이 줄. 그보다 좁으면 단계가 세로 줄, 브랜드 · 매장이 칸.
 * 줄 이름은 한 단계 진한 색, 할 일 칸은 옅은 색 — 예전엔 흰 단계 카드 여섯 장(설명 · 누가 하는지 칩 · 작은 사진).
 */
function Flow() {
  return (
    <section>
      <Reveal className="mx-auto flex max-w-[640px] flex-col items-center text-center">
        <Eyebrow>진행 방식</Eyebrow>
        {/* 11-23 사용자 문구 — 쉼표에서 줄을 나누고 둘째 줄만 보라("진행과정"은 띄어 씀). */}
        <h2 className={H2}>
          의뢰부터 결과 보고까지,
          <br />
          <span className="text-primary">콜라보 진행 과정 한눈에 보기</span>
        </h2>
        <p className={cn(LEAD, "mt-[16px] sm:mt-[20px]")}>
          admix가 콜라보 기획부터 운영 조율, 결과 보고까지 담당합니다.
        </p>
      </Reveal>
      <Reveal className="mt-[40px] sm:mt-[64px]">
        <FlowRows />
        <FlowColumns />
      </Reveal>
    </section>
  );
}

const FLOW_SIDES = ["brand", "partner"] as const;
type FlowSide = (typeof FLOW_SIDES)[number];
/** 줄 · 칸 이름(브랜드 · 매장) — 할 일 칸보다 한 단계 진하게. */
const FLOW_LABEL: Record<FlowSide, string> = {
  // 보라 글자는 primary-700 그대로 — 다크에선 토큰이 밝은 보라로 바뀐다(primary-200은 다크에서 어두워 안 보임).
  brand: "bg-primary-100 text-primary-700 dark:bg-primary-500/25",
  partner:
    "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
};
const FLOW_CELL: Record<FlowSide, string> = {
  brand: "bg-primary-50 dark:bg-primary-500/10",
  partner: "bg-amber-50 dark:bg-amber-400/10",
};
const flowNo = (i: number) => String(i + 1).padStart(2, "0");

function FlowLabel({
  side,
  className,
}: {
  side: FlowSide;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[12px] font-bold",
        FLOW_LABEL[side],
        className,
      )}
    >
      {side === "brand" ? "브랜드" : "매장"}
    </div>
  );
}

function FlowCell({
  side,
  text,
  className,
}: {
  side: FlowSide;
  text?: string;
  className?: string;
}) {
  // 하지 않는 단계는 빈칸 — 자리만 지킨다.
  if (!text) return <div aria-hidden />;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-[12px] text-center font-medium break-keep text-gray-800",
        FLOW_CELL[side],
        className,
      )}
    >
      {text}
    </div>
  );
}

/**
 * PC(lg) — 단계가 가로 칸. 왼쪽 첫 칸은 줄 이름(브랜드 · 매장).
 * lg(본문 약 800px)는 할 일이 두 줄로 넘어가지 않게 이름 칸 · 사이 · 글자를 한 단계 작게, xl부터 넉넉하게.
 */
function FlowColumns() {
  return (
    <div className="hidden grid-cols-[72px_repeat(6,minmax(0,1fr))] gap-x-[6px] gap-y-[10px] lg:grid xl:grid-cols-[88px_repeat(6,minmax(0,1fr))] xl:gap-x-[8px]">
      <div />
      {FLOW.map((s, i) => (
        <div key={s.title} className="flex flex-col items-center text-center">
          <span className="text-[13px] font-bold text-primary">
            {flowNo(i)}
          </span>
          <span className="mt-[2px] text-[17px] leading-[1.4] font-bold tracking-[-0.02em] break-keep text-gray-900">
            {s.title}
          </span>
        </div>
      ))}
      {/* 단계를 잇는 줄 — 칸 가운데마다 보라 점. */}
      <div />
      {/* 줄은 첫 칸 가운데부터 끝 칸 가운데까지 — 칸 폭의 반 = (전체 - 사이 다섯) / 12. */}
      <div className="relative col-span-6 mb-[6px] grid h-[9px] grid-cols-6 gap-x-[6px] xl:gap-x-[8px]">
        <span className="absolute inset-x-[calc((100%-30px)/12)] top-1/2 h-px -translate-y-1/2 bg-gray-200 xl:inset-x-[calc((100%-40px)/12)]" />
        {FLOW.map((s) => (
          <span
            key={s.title}
            className="relative mx-auto size-[9px] rounded-full bg-primary"
          />
        ))}
      </div>
      {FLOW_SIDES.map((side) => (
        <Fragment key={side}>
          <FlowLabel side={side} className="text-[14px] xl:text-[15px]" />
          {FLOW.map((s) => (
            <FlowCell
              key={s.title}
              side={side}
              text={s[side]}
              className="min-h-[64px] px-[6px] py-[12px] text-[13px] leading-[1.45] xl:px-[10px] xl:text-[14px]"
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/** PC보다 좁을 때 — 단계가 세로 줄(번호 동그라미 · 이름), 브랜드 · 매장이 칸. */
function FlowRows() {
  return (
    <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-[6px] gap-y-[8px] sm:gap-x-[10px] sm:gap-y-[10px] lg:hidden">
      <div />
      {FLOW_SIDES.map((side) => (
        <FlowLabel
          key={side}
          side={side}
          className="h-[36px] text-[13px] sm:h-[42px] sm:text-[15px]"
        />
      ))}
      {FLOW.map((s, i) => (
        <Fragment key={s.title}>
          <div className="flex min-w-0 items-center gap-[8px] sm:gap-[10px]">
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-primary-100 text-[11px] font-bold text-primary-700 sm:size-[30px] sm:text-[12px] dark:bg-primary-500/25">
              {flowNo(i)}
            </span>
            <span className="min-w-0 text-[14px] leading-[1.35] font-bold break-keep text-gray-900 sm:text-[16px]">
              {s.title}
            </span>
          </div>
          {FLOW_SIDES.map((side) => (
            <FlowCell
              key={side}
              side={side}
              text={s[side]}
              className="min-h-[48px] px-[8px] py-[10px] text-[12px] leading-[1.4] sm:min-h-[56px] sm:text-[14px]"
            />
          ))}
        </Fragment>
      ))}
    </div>
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
          {/* 제목은 한 줄(11-23 사용자 — "admix가 / 맡는 일"로 끊겨 배치가 이상해 보였다). */}
          <h2 className={H2}>admix가 맡는 일</h2>
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
              className="size-[44px] rounded-full border-gray-200 bg-surface"
            >
              <ChevronLeftIcon className="size-[18px]" />
            </Button>
            <Button
              isIconOnly
              variant="outline"
              aria-label="다음 카드"
              isDisabled={edge.end}
              onPress={() => go(1)}
              className="size-[44px] rounded-full border-gray-200 bg-surface"
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

/** 왼쪽 제목 · 설명, 오른쪽 브랜드 · 매장 두 줄 카드 — 오른쪽 줄을 조금 내려 엇갈리게(전자서명 계약서 양식). 휴대폰은 브랜드 · 매장 탭(11-24). */
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
      {/* 휴대폰만 브랜드 · 매장 탭(11-24 사용자, 기본 브랜드) — 탭은 색 없이 HeroUI 기본(같은 날 "탭에서는 색깔을 빼줘").
          고른 쪽 카드 세 장만 한 줄로. 태블릿 · PC는 아래 두 줄 엇갈림 그대로("PC는 다시 원래대로"). */}
      <Tabs defaultSelectedKey="advertiser" className="gap-[16px] sm:hidden">
        <Tabs.ListContainer className="w-fit rounded-[17px]">
          <Tabs.List aria-label="회원 유형">
            {AUDIENCES.map((a) => (
              <Tabs.Tab
                key={a.id}
                id={a.id}
                // 줄바꿈 없이(처음엔 "브랜\n드"로 꺾였다), 두 탭 폭을 비슷하게.
                className="min-w-[84px] rounded-[13px] px-[20px] whitespace-nowrap"
              >
                {a.label}
                <Tabs.Indicator className="rounded-[13px]" />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {AUDIENCES.map((a) => (
          <Tabs.Panel
            key={a.id}
            id={a.id}
            className="flex flex-col gap-[12px] p-0"
          >
            {a.items.map((it, i) => (
              <AudienceCard
                key={it.title}
                item={it}
                partner={a.id === "partner"}
                delay={i * 90}
              />
            ))}
          </Tabs.Panel>
        ))}
      </Tabs>
      <div className="hidden gap-[16px] sm:grid sm:grid-cols-2">
        {AUDIENCES.map((a, col) => (
          <div
            key={a.id}
            className={cn("flex flex-col gap-[16px]", col === 1 && "mt-[64px]")}
          >
            {/* 이름표도 브랜드 보라 · 매장 노랑(11-24 사용자, 예전 회색) — 아이콘 칸 · 진행 방식 칩(ACTOR)과 같은 짝. cn(tailwind-merge)이 뒤 bg 를 남긴다. */}
            <span
              className={cn(
                "w-fit rounded-full px-[12px] py-[4px] text-[13px] font-semibold",
                ACTOR[a.id === "partner" ? "partner" : "brand"].className,
                // 흰 바탕에선 매장 amber-50 이 거의 안 보여 한 단계 진하게(진행 방식 칩은 회색 카드 위라 그대로).
                a.id === "partner" && "bg-amber-100",
              )}
            >
              {a.label}
            </span>
            {a.items.map((it, i) => (
              <AudienceCard
                key={it.title}
                item={it}
                partner={a.id === "partner"}
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
  partner,
  delay,
}: {
  item: (typeof AUDIENCES)[number]["items"][number];
  /** 매장 카드 — 아이콘 칸을 노랑으로(브랜드는 보라). 진행 방식의 누가 하는지 칩(ACTOR: 브랜드 보라 · 매장 노랑)과 같은 짝. */
  partner: boolean;
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
      {/* 브랜드 · 매장 색 구분(11-23 사용자: "아이콘 배경 색을 바꿀까?"). */}
      <span
        className={cn(
          "flex size-[36px] items-center justify-center rounded-[11px] text-white",
          partner ? "bg-amber-500" : "bg-primary",
        )}
      >
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
